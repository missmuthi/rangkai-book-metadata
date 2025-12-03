import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGoogleBooksWithTimeout, fetchGoogleBooks } from "./google-books";
import { Analytics } from "$lib/services/analytics";
import { logger } from "$lib/server/logger";
import { CircuitBreaker } from "$lib/server/utils/resilience";

// Mock dependencies
vi.mock("$lib/services/analytics");
vi.mock("$lib/server/logger");
vi.mock("$lib/server/utils/resilience", async () => {
  return {
    withTimeout: vi.fn((promise) => promise), // Pass through
    CircuitBreaker: class {
      constructor() {}
      async isOpen() {
        return false;
      }
      async success() {}
      async failure() {}
      async open() {}
    },
  };
});
vi.mock("$lib/server/cache", () => ({
  getKV: vi.fn().mockReturnValue(null),
}));
vi.mock("$lib/utils/json", () => ({
  parseJsonSafe: vi.fn().mockImplementation(async (res) => {
    if (res.ok) return { items: [] }; // Minimal valid response
    throw new Error("Parse error");
  }),
}));

describe("Google Books Adapter", () => {
  const mockFetch = vi.fn();
  const mockPlatform = {
    env: {
      GOOGLE_BOOKS_API_KEY: "test-api-key",
      DISABLE_GOOGLE_BOOKS_FALLBACK: "false",
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock implementation for fetch to return success
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    // Mock performance.now
    vi.spyOn(performance, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchGoogleBooks (Low Level)", () => {
    it("should track metrics correctly on success", async () => {
      await fetchGoogleBooks(mockFetch, "test-query", false, 1, "key123", true);

      expect(Analytics.track).toHaveBeenCalledWith(
        "api_timing",
        expect.objectContaining({
          success: true,
          authType: "Authenticated",
          fallback_triggered: true,
        }),
      );
    });

    it("should distinguish quota errors (Authenticated)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Quota Exceeded",
      });

      await expect(
        fetchGoogleBooks(mockFetch, "test", false, 1, "key123"),
      ).rejects.toThrow();

      expect(Analytics.track).toHaveBeenCalledWith(
        "error_occurred",
        expect.objectContaining({
          error_type: "quota_exceeded_auth",
        }),
      );
    });

    it("should distinguish quota errors (Public)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Quota Exceeded",
      });

      await expect(
        fetchGoogleBooks(mockFetch, "test", false, 1, undefined),
      ).rejects.toThrow();

      expect(Analytics.track).toHaveBeenCalledWith(
        "error_occurred",
        expect.objectContaining({
          error_type: "quota_exceeded_public",
        }),
      );
    });
  });

  describe("fetchGoogleBooksWithTimeout (High Level Logic)", () => {
    it("Test Case 1 (Happy Path): API Key works -> returns data", async () => {
      // Setup: Fetch returns 200 immediately
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await fetchGoogleBooksWithTimeout(
        mockPlatform as any,
        mockFetch,
        "isbn123",
        true,
      );

      // Verify fetch called once with API key
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain("key=test-api-key");
      expect(result).not.toBeNull();
    });

    it("Test Case 2 (The Fallback): API Key returns 403 -> Retry without Key -> returns data", async () => {
      // Setup: First call 403, Second call 200
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Quota",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const result = await fetchGoogleBooksWithTimeout(
        mockPlatform as any,
        mockFetch,
        "isbn123",
        true,
      );

      // Verify fetch called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // First call has key
      expect(mockFetch.mock.calls[0][0]).toContain("key=test-api-key");
      // Second call has NO key
      expect(mockFetch.mock.calls[1][0]).not.toContain("key=test-api-key");

      // Verify Analytics tracked degraded state
      expect(Analytics.track).toHaveBeenCalledWith(
        "metadata_source_degraded",
        expect.objectContaining({
          reason: "quota_exceeded",
          fallback: "public_endpoint",
        }),
      );

      expect(result).not.toBeNull();
    });

    it("Test Case 3 (Total Failure): API Key returns 403 -> Retry returns 403 -> Throws Error (returns null)", async () => {
      // Setup: Both calls return 403
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Quota Auth",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Quota Public",
        });

      const result = await fetchGoogleBooksWithTimeout(
        mockPlatform as any,
        mockFetch,
        "isbn123",
        true,
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toBeNull();

      // Should log error
      expect(logger.error).toHaveBeenCalledWith(
        "google_books_fallback_failed",
        expect.any(Object),
      );
    });

    it("Test Case 4 (Flag Disabled): Flag is set -> Key returns 403 -> Throws immediately", async () => {
      // Setup: Platform has disable flag set
      const disabledPlatform = {
        env: {
          GOOGLE_BOOKS_API_KEY: "test-api-key",
          DISABLE_GOOGLE_BOOKS_FALLBACK: "true",
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Quota",
      });

      const result = await fetchGoogleBooksWithTimeout(
        disabledPlatform as any,
        mockFetch,
        "isbn123",
        true,
      );

      // Verify fetch called ONLY once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toBeNull(); // Returns null on failure

      // Should NOT have logged fallback warning
      expect(logger.warn).not.toHaveBeenCalledWith(
        "google_books_quota_fallback",
        expect.any(Object),
      );
    });
  });
});
