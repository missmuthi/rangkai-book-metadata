/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for GET /api/book/[isbn] endpoint
 *
 * Tests:
 * - Valid ISBN metadata fetch
 * - D1 cache hit/miss behavior (New Arch)
 * - Invalid ISBN handling
 * - Provider failure scenarios
 * - Response headers and format
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseJsonSafe } from "$lib/utils/json";
import { GET } from "../../../routes/api/book/[isbn]/+server";

// Mock global caches.default
const mockCachePut = vi.fn();
const mockCacheMatch = vi.fn();

// Add missing properties to mock Request/Response for Cache API
// Mock global Request for tests
globalThis.Request = class MockRequest {
  public url: string;
  public headers: Map<string, string>;
  constructor(input: any) {
    this.url = input;
    this.headers = new Map();
  }
} as any;

// Provide simplified caches.default mock for tests
globalThis.caches = {
  default: {
    put: mockCachePut,
    match: mockCacheMatch,
  },
} as any;

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

// Mock DB interactions
const mockBind = vi.fn();
const mockFirst = vi.fn();
const mockPrepare = vi.fn(() => ({
  bind: mockBind.mockReturnThis(),
  first: mockFirst,
}));

vi.mock("$lib/server/db", () => ({
  getRawDb: vi.fn((platform: any) => {
    return (
      platform?.env?.DB || {
        prepare: mockPrepare,
      }
    );
  }),
  createAnonymousScan: vi.fn(async () => undefined),
  createScan: vi.fn(async () => 1),
  getDrizzleDB: vi.fn((_platform: any) => undefined),
}));

// Helper to create mock RequestEvent
function createMockEvent(options: {
  isbn: string;
  hasWaitUntil?: boolean;
  isAuthenticated?: boolean;
}): any {
  const { isbn, hasWaitUntil = true, isAuthenticated = true } = options;

  const waitUntilPromises: Promise<any>[] = [];

  return {
    params: { isbn },
    platform: {
      env: {
        DB: {
          prepare: mockPrepare,
        } as any,
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
      url: `http://localhost/api/book/${isbn}`,
      headers: {
        get: (_key: string) => null,
      },
    },
    _waitUntilPromises: waitUntilPromises,
  } as any;
}

describe("GET /api/book/[isbn] - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirst.mockResolvedValue(null); // Default: D1 Miss
    mockCacheMatch.mockResolvedValue(null); // Default: HTTP Cache Miss
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
    it("should return cached data with D1-HIT header", async () => {
      const event = createMockEvent({ isbn: "9780134685991" });

      // Simulate D1 Hit
      mockFirst.mockResolvedValueOnce({
        json_data: JSON.stringify({
          isbn: "9780134685991",
          title: "Effective Java (D1 Cached)",
          authors: ["Joshua Bloch"],
          publisher: "Addison-Wesley",
          publishedDate: "2018",
          dataSource: "d1",
        }),
      });

      const response = await GET(event);
      const data = (await parseJsonSafe(response)) as any;

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("D1-HIT");
      expect(data.title).toContain("Cached");
    });

    it("should fetch from provider on D1 cache miss", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });
      // mockFirst returns null by default (miss)

      const response = await GET(event);
      const data = (await parseJsonSafe(response)) as any;

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("MISS");
      expect(data.title).toBe("Clean Code");
    });

    it("should save to HTTP cache on miss (background)", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      await GET(event);

      // Wait a bit for background promise
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCachePut).toHaveBeenCalled();
    });
  });

  describe("Metadata Fetch - Happy Path", () => {
    it("should return merged book data", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);
      const data = (await parseJsonSafe(response)) as any;

      expect(data).toMatchObject({
        isbn: "9780132350884",
        title: "Clean Code",
        authors: ["Robert C. Martin"],
        publisher: "Prentice Hall",
        publishedDate: "2008",
      });
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
  });

  describe("Response Headers", () => {
    it("should set appropriate cache headers on D1 HIT", async () => {
      const event = createMockEvent({ isbn: "9780134685991" });

      // Simulate D1 Hit
      mockFirst.mockResolvedValueOnce({
        json_data: JSON.stringify({
          isbn: "9780134685991",
          title: "Cached Book",
        }),
      });

      const response = await GET(event);

      expect(response.headers.get("Cache-Control")).toContain("public");
      expect(response.headers.get("X-Cache")).toBe("D1-HIT");
      expect(response.headers.get("X-Response-Time")).toMatch(/\d+ms/);
    });

    it("should set appropriate cache headers on MISS", async () => {
      const event = createMockEvent({ isbn: "9780132350884" });

      const response = await GET(event);

      expect(response.headers.get("Cache-Control")).toContain("public");
      expect(response.headers.get("X-Cache")).toBe("MISS");
      expect(response.headers.get("X-Response-Time")).toMatch(/\d+ms/);
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
      expect(event._waitUntilPromises.length).toBeGreaterThan(0);
    });
  });
});
