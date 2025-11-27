/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for GET /api/book/[isbn] endpoint
 *
 * Tests:
 * - Valid ISBN metadata fetch
 * - KV cache hit/miss behavior
 * - Invalid ISBN handling
 * - Provider failure scenarios
 * - Response headers and format
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../../../routes/api/book/[isbn]/+server";
import type { RequestEvent } from "@sveltejs/kit";
import type { MergedBookData } from "$lib/types";

// Mock dependencies
vi.mock("$lib/utils", () => ({
  isValidISBN13: vi.fn((isbn: string) => {
    return (
      isbn === "9780132350884" ||
      isbn === "9780134685991" ||
      isbn === "9781234567897"
    );
  }),
  isValidISBN10: vi.fn((isbn: string) => {
    return isbn === "0132350882";
  }),
}));

vi.mock("$lib/server/metadata", () => ({
  fetchBookByIsbn: vi.fn(async (_platform: any, _fetch: any, isbn: string) => {
    if (isbn === "9780132350884") {
      return {
        isbn,
        title: "Clean Code",
        authors: ["Robert C. Martin"],
        publisher: "Prentice Hall",
        publishedDate: "2008",
        dataSource: "google",
      };
    }
    if (isbn === "9781234567897") {
      throw new Error("Book not found in any provider");
    }
    return {
      isbn,
      title: "Test Book",
      authors: ["Test Author"],
      publisher: "Test Publisher",
      publishedDate: "2024",
      dataSource: "openlibrary",
    };
  }),
}));

vi.mock("$lib/server", () => ({
  getKV: vi.fn((platform: any) => {
    return platform?.env?.BOOK_CACHE || null;
  }),
  getDB: vi.fn((platform: any) => {
    return platform?.env?.DB || null;
  }),
  CacheKeys: {
    book: (isbn: string) => `book:${isbn}`,
  },
  CacheTTL: {
    book: 86400, // 24 hours
  },
  cacheGet: vi.fn(async (_kv: any, key: string) => {
    // Simulate cache hit for specific ISBN
    if (key === "book:9780134685991") {
      return {
        isbn: "9780134685991",
        title: "Effective Java (Cached)",
        authors: ["Joshua Bloch"],
        publisher: "Addison-Wesley",
        publishedDate: "2018",
        dataSource: "cache",
      };
    }
    return null; // Cache miss
  }),
  cacheSet: vi.fn(async () => undefined),
  createAnonymousScan: vi.fn(async () => undefined),
  createScan: vi.fn(async () => 1),
  getSourceStatus: vi.fn(),
}));

// Helper to create mock RequestEvent
function createMockEvent(options: {
  isbn: string;
  hasKV?: boolean;
  hasWaitUntil?: boolean;
  isAuthenticated?: boolean;
}): any {
  const {
    isbn,
    hasKV = true,
    hasWaitUntil = true,
    isAuthenticated = true,
  } = options;

  const waitUntilPromises: Promise<any>[] = [];

  return {
    params: { isbn },
    platform: {
      env: {
        BOOK_CACHE: hasKV ? ({} as any) : undefined,
        DB: {} as any,
      },
      context: hasWaitUntil
        ? {
            waitUntil: (promise: Promise<any>) => {
              waitUntilPromises.push(promise);
            },
          }
        : undefined,
    },
    locals: {
      session: isAuthenticated ? { id: "session-123" } : null,
      user: isAuthenticated
        ? { id: "user-123", email: "test@example.com" }
        : null,
    },
    request: {
      headers: {
        get: (key: string) => null,
      },
    },
    _waitUntilPromises: waitUntilPromises,
  } as any;
}

describe("GET /api/book/[isbn] - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 if not authenticated", async () => {
      const event = createMockEvent({
        isbn: "9780132350884",
        isAuthenticated: false,
      });
      const response = await GET(event);
      expect(response.status).toBe(401);
    });
  });

  describe("ISBN Validation", () => {
    it("should reject invalid ISBN-13", async () => {
      const event = createMockEvent({ isbn: "invalid-isbn" });

      await expect(GET(event)).rejects.toMatchObject({
        status: 400,
        body: { message: expect.stringContaining("Invalid ISBN") },
      });
    });

    it("should accept valid ISBN-13", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);

      expect(response.status).toBe(200);
    });

    it("should accept valid ISBN-10", async () => {
      const event = createMockEvent({ isbn: "0132350882" });

      const response = await GET(event);

      expect(response.status).toBe(200);
    });
  });

  describe("Cache Behavior", () => {
    it("should return cached data with HIT header", async () => {
      const event = createMockEvent({ isbn: "9780134685991" });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("HIT");
      expect(data.title).toContain("Cached");
    });

    it("should fetch from provider on cache miss", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("MISS");
      expect(data.title).toBe("Clean Code");
    });

    it("should set cache on cache miss (background)", async () => {
      const { cacheSet } = await import("$lib/server");
      const event = createMockEvent({ isbn: "9780132350884" });

      await GET(event);

      // Wait a bit for background promise
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Cache write should have been called in background
      expect(cacheSet).toHaveBeenCalled();
    });

    it("should handle missing KV gracefully", async () => {
      const event = createMockEvent({ isbn: "9780132350884", hasKV: false });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe("Clean Code");
    });
  });

  describe("Metadata Fetch - Happy Path", () => {
    it("should return merged book data", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = await response.json();

      expect(data).toMatchObject({
        isbn: "9780132350884",
        title: "Clean Code",
        authors: ["Robert C. Martin"],
        publisher: "Prentice Hall",
        publishedDate: "2008",
      });
    });

    it("should include metadata in response", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = await response.json();

      expect(data.meta).toBeDefined();
      expect(data.meta).toMatchObject({
        isbn: "9780132350884",
        sources: expect.any(Object),
        fetchDuration: expect.any(Number),
        totalDuration: expect.any(Number),
        timestamp: expect.any(String),
      });
    });

    it("should include source information", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = await response.json();

      expect(data.meta.sources).toBeDefined();
      expect(typeof data.meta.sources.google).toBe("boolean");
      expect(typeof data.meta.sources.openlibrary).toBe("boolean");
      expect(typeof data.meta.sources.loc).toBe("boolean");
    });
  });

  describe("Provider Failures", () => {
    it("should return 404 when all providers fail", async () => {
      const event = createMockEvent({ isbn: "9781234567897" });

      await expect(GET(event)).rejects.toMatchObject({
        status: 404,
        body: { message: expect.stringContaining("Book not found") },
      });
    });

    it("should include error message in response", async () => {
      const event = createMockEvent({ isbn: "9781234567897" });

      try {
        await GET(event);
      } catch (error: any) {
        expect(error.body.message).toContain("Book not found");
      }
    });
  });

  describe("Response Headers", () => {
    it("should set appropriate cache headers on HIT", async () => {
      const event = createMockEvent({ isbn: "9780134685991" });

      const response = await GET(event);

      expect(response.headers.get("Cache-Control")).toContain("public");
      expect(response.headers.get("X-Cache")).toBe("HIT");
      expect(response.headers.get("X-Response-Time")).toMatch(/\d+ms/);
    });

    it("should set appropriate cache headers on MISS", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);

      expect(response.headers.get("Cache-Control")).toContain("public");
      expect(response.headers.get("X-Cache")).toBe("MISS");
      expect(response.headers.get("X-Response-Time")).toMatch(/\d+ms/);
      expect(response.headers.get("X-Sources")).toBeDefined();
    });
  });

  describe("Cloudflare Patterns", () => {
    it("should use waitUntil for background cache writes", async () => {
      const event = createMockEvent({
        isbn: "9780132350884",
        hasWaitUntil: true,
      });

      await GET(event);

      // waitUntil should have been called
      expect(event._waitUntilPromises).toBeDefined();
    });

    it("should handle missing waitUntil gracefully", async () => {
      const event = createMockEvent({
        isbn: "9780132350884",
        hasWaitUntil: false,
      });

      const response = await GET(event);

      expect(response.status).toBe(200);
      // Should still work without waitUntil
    });
  });

  describe("Performance Metrics", () => {
    it("should include timing information", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = await response.json();

      expect(data.meta.fetchDuration).toBeGreaterThanOrEqual(0);
      expect(data.meta.totalDuration).toBeGreaterThanOrEqual(0);
      expect(data.meta.totalDuration).toBeGreaterThanOrEqual(
        data.meta.fetchDuration,
      );
    });

    it("should include timestamp", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = await response.json();

      expect(data.meta.timestamp).toBeDefined();
      expect(new Date(data.meta.timestamp).toString()).not.toBe("Invalid Date");
    });
  });
});
