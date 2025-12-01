/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBookScan,
  getScanHistory,
  validateISBN,
  batchCreateScans,
} from "./service";
import type { RequestEvent } from "@sveltejs/kit";
import type { MergedBookData } from "$lib/types";

// Mock dependencies
vi.mock("$lib/server/metadata", () => ({
  fetchBookByIsbn: vi.fn((_platform, _fetch, isbn) => {
    if (isbn === "9780132350884") {
      return Promise.resolve(mockMetadata);
    }
    return Promise.resolve(null);
  }),
}));

// Create mock KV with proper methods
const mockKV = {
  get: vi.fn(() => Promise.resolve(null)),
  put: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve()),
  list: vi.fn(() => Promise.resolve({ keys: [] })),
};

vi.mock("$lib/server/db", () => ({
  getRawDb: vi.fn(() => mockDB),
  createScan: vi.fn((_db, _userId, _isbn, _title, _jsonData, _status) => {
    return Promise.resolve(mockScanId);
  }),
  getUserScans: vi.fn((_db, _userId, _limit) => {
    return Promise.resolve(mockScans);
  }),
  countUserScans: vi.fn((_db, _userId) => {
    return Promise.resolve(mockScans.length);
  }),
}));

vi.mock("$lib/server/cache", () => ({
  getKV: vi.fn(() => mockKV),
  CacheKeys: {
    book: (isbn: string) => `book:${isbn}`,
  },
  CacheTTL: {
    book: 300,
  },
  cacheGet: vi.fn((_kv, _key) => Promise.resolve(null)),
  cacheSet: vi.fn((_kv, _key, _value, _ttl) => Promise.resolve()),
}));

vi.mock("$lib/server/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  LogEvents: {
    SCAN_FETCH_FAILED: "scan_fetch_failed",
    DB_QUERY_FAILED: "db_query_failed",
  },
}));

// Mock data
const mockDB = {} as any;
const mockScanId = 123;
const mockMetadata: MergedBookData = {
  title: "Clean Code",
  author: "Martin, Robert C.",
  publisher: "Prentice Hall",
  date: "2008",
  pages: "464",
  isbn13: "9780132350884",
  isbn10: "0132350882",
  ddc: "005.1",
  lcc: "QA76.76.D47",
  callNumber: "005.1 M366 C 2008",
  description: "A handbook of agile software craftsmanship",
  language: "English",
  subjects: "Computers; Programming",
  series: "-",
  publisherString: "Upper Saddle River, NJ : Prentice Hall, 2008",
  collation: "464 p.",
  classification: "005.1",
  edition: "",
  specificDetail: "",
  gmd: "Text",
  infoLink: "http://books.google.com/books?id=123",
  cover: "http://books.google.com/cover.jpg",
  isPartialData: false,
  dataSource: "google-openlibrary" as const,
};

const mockScans = [
  {
    id: 1,
    user_id: "user123",
    isbn: "9780132350884",
    title: "Clean Code",
    json_data: JSON.stringify(mockMetadata),
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Helper to create mock RequestEvent
function createMockEvent(userId?: string): RequestEvent {
  return {
    locals: {
      user: userId ? { id: userId, email: "test@example.com" } : undefined,
      session: userId ? { userId } : undefined,
    },
    platform: {
      env: {
        DB: mockDB,
        BOOK_CACHE: mockKV,
      },
    },
    fetch: vi.fn(),
  } as any;
}

describe("Scan Module - Business Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBookScan", () => {
    it("should create scan successfully with valid ISBN", async () => {
      const event = createMockEvent("user123");
      const result = await createBookScan(event, "9780132350884");

      expect(result.success).toBe(true);
      expect(result.scan).toBeDefined();
      expect(result.scan?.isbn).toBe("9780132350884");
      expect(result.scan?.title).toBe("Clean Code");
      expect(result.scan?.id).toBe(mockScanId);
    });

    it("should reject scan for unauthenticated user", async () => {
      const event = createMockEvent(); // No userId
      const result = await createBookScan(event, "9780132350884");

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("should reject invalid ISBN-13", async () => {
      const event = createMockEvent("user123");
      const result = await createBookScan(event, "9780132350889"); // Invalid check digit

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid ISBN format");
    });

    it("should reject invalid ISBN-10", async () => {
      const event = createMockEvent("user123");
      const result = await createBookScan(event, "0132350888"); // Invalid check digit

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid ISBN format");
    });

    it("should reject malformed ISBN (too short)", async () => {
      const event = createMockEvent("user123");
      const result = await createBookScan(event, "12345");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid ISBN format");
    });

    it("should handle cache hit scenario", async () => {
      const { cacheGet } = await import("$lib/server");
      vi.mocked(cacheGet).mockResolvedValueOnce(mockMetadata);

      const event = createMockEvent("user123");
      const result = await createBookScan(event, "9780132350884");

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
    });

    it("should handle cache miss and fetch from metadata engine", async () => {
      const { cacheGet, cacheSet } = await import("$lib/server");
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const event = createMockEvent("user123");
      const result = await createBookScan(event, "9780132350884");

      expect(result.success).toBe(true);
      expect(result.cached).toBe(false);
      expect(cacheSet).toHaveBeenCalled();
    });

    it("should handle metadata fetch failure gracefully", async () => {
      const { fetchBookByIsbn } = await import("$lib/server/metadata");
      vi.mocked(fetchBookByIsbn).mockRejectedValueOnce(
        new Error("API timeout"),
      );

      const event = createMockEvent("user123");
      // Use a valid ISBN format but one that will fail to fetch
      const result = await createBookScan(event, "9780132350884");

      expect(result.success).toBe(false);
      expect(result.error).toContain("API timeout");
    });
  });

  describe("getScanHistory", () => {
    it("should return scan history for authenticated user", async () => {
      const event = createMockEvent("user123");
      const result = await getScanHistory(event, 50, 0);

      expect(result.scans).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.hasMore).toBe(false);
    });

    it("should return empty array for unauthenticated user", async () => {
      const event = createMockEvent(); // No userId
      const result = await getScanHistory(event);

      expect(result.scans).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should handle pagination correctly", async () => {
      const { countUserScans } = await import("$lib/server");
      vi.mocked(countUserScans).mockResolvedValueOnce(100);

      const event = createMockEvent("user123");
      const result = await getScanHistory(event, 10, 0);

      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(true); // 100 total > 0 + 1 scans
    });

    it("should handle database errors gracefully", async () => {
      const { getUserScans } = await import("$lib/server");
      vi.mocked(getUserScans).mockRejectedValueOnce(
        new Error("DB connection failed"),
      );

      const event = createMockEvent("user123");
      const result = await getScanHistory(event);

      expect(result.scans).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("validateISBN", () => {
    it("should validate correct ISBN-13", () => {
      const result = validateISBN("9780132350884");
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should validate correct ISBN-10", () => {
      const result = validateISBN("0132350882");
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should validate ISBN with hyphens", () => {
      const result = validateISBN("978-0-13-235088-4");
      expect(result.valid).toBe(true);
    });

    it("should validate ISBN with spaces", () => {
      const result = validateISBN("978 0 13 235088 4");
      expect(result.valid).toBe(true);
    });

    it("should reject ISBN-13 with invalid check digit", () => {
      const result = validateISBN("9780132350889");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Invalid ISBN-13 check digit");
    });

    it("should reject ISBN-10 with invalid check digit", () => {
      const result = validateISBN("0132350888");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Invalid ISBN-10 check digit");
    });

    it("should reject ISBN with invalid length", () => {
      const result = validateISBN("12345");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Invalid ISBN length");
    });

    it("should handle ISBN-10 ending in X", () => {
      const result = validateISBN("043942089X");
      expect(result.valid).toBe(true);
    });
  });

  describe("batchCreateScans", () => {
    it("should create multiple scans sequentially", async () => {
      const { fetchBookByIsbn } = await import("$lib/server/metadata");
      // Mock to return metadata for both ISBNs
      vi.mocked(fetchBookByIsbn).mockResolvedValue(mockMetadata);

      const event = createMockEvent("user123");
      const isbns = ["9780132350884", "9780134685991"];

      const results = await batchCreateScans(event, isbns);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
    });

    it("should continue on individual failures", async () => {
      const { fetchBookByIsbn } = await import("$lib/server/metadata");
      // Mock to return metadata for valid ISBNs
      vi.mocked(fetchBookByIsbn).mockResolvedValue(mockMetadata);

      const event = createMockEvent("user123");
      const isbns = ["9780132350884", "invalid-isbn", "9780134685991"];

      const results = await batchCreateScans(event, isbns);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false); // Invalid ISBN
      expect(results[2].success).toBe(true);
    });

    it("should add delay between requests to avoid rate limiting", async () => {
      const event = createMockEvent("user123");
      const isbns = ["9780132350884", "9780134685991"];

      const startTime = Date.now();
      await batchCreateScans(event, isbns);
      const duration = Date.now() - startTime;

      // Should take at least 200ms delay between 2 requests
      expect(duration).toBeGreaterThanOrEqual(200);
    });
  });
});
