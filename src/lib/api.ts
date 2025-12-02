import type {
  OpenLibraryBookData,
  GoogleBooksResponse,
  OpenLibrarySearchResponse,
  LoCBookData,
  MergedBookData,
  GoogleBookItem,
} from "./types";
import { getISBNSibling, isISBN } from "./utils";
import { Analytics } from "./services/analytics";
import { parseJsonSafe, isErrorObject } from "$lib/utils/json";

/**
 * API Service Layer - Centralized API calls with enhanced error handling
 * Now supports 3 sources: Google Books, OpenLibrary, and Library of Congress
 */
export class BookApiService {
  private static readonly GOOGLE_BOOKS_BASE =
    "https://www.googleapis.com/books/v1/volumes";
  private static readonly OPENLIBRARY_BASE = "/api/openlibrary";
  private static readonly LOC_BASE = "https://www.loc.gov/books/";

  /**
   * Fetch book data from Google Books API
   */
  static async fetchGoogleBooks(
    query: string,
    isIsbn: boolean,
    maxResults = 1,
  ): Promise<GoogleBooksResponse | null> {
    const startTime = performance.now();
    const q = isIsbn ? `isbn:${query}` : `intitle:${query}`;
    const url = `${this.GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;

    try {
      const response = await fetch(url);
      const duration = Math.round(performance.now() - startTime);

      if (!response.ok) {
        const errorType =
          response.status === 503
            ? "api_503"
            : response.status === 429
              ? "rate_limit"
              : "unknown";
        Analytics.track("error_occurred", {
          error_type: errorType,
          source: "google",
          message: `${response.status} ${response.statusText}`,
        });
        throw new Error(
          `Google Books API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await parseJsonSafe(response)) as GoogleBooksResponse;

      // Track API timing
      Analytics.track("api_timing", {
        source: "google",
        endpoint: isIsbn ? "isbn_search" : "title_search",
        duration_ms: duration,
        success: true,
      });

      return data;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      Analytics.track("api_timing", {
        source: "google",
        endpoint: isIsbn ? "isbn_search" : "title_search",
        duration_ms: duration,
        success: false,
      });
      throw error;
    }
  }

  /**
   * Fetch book data from OpenLibrary API (via proxy)
   * Gracefully handles rate limiting and service unavailability
   */
  static async fetchOpenLibrary(
    query: string,
    isIsbn: boolean,
    limit = 1,
  ): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
    const startTime = performance.now();
    const url = `${this.OPENLIBRARY_BASE}?q=${encodeURIComponent(query)}&isbn=${isIsbn}&limit=${limit}`;

    try {
      const response = await fetch(url);
      const duration = Math.round(performance.now() - startTime);

      // Graceful degradation: Don't throw on 503/429, return null to allow Google Books fallback
      if (!response.ok) {
        const errorType =
          response.status === 503
            ? "api_503"
            : response.status === 429
              ? "rate_limit"
              : "unknown";
        Analytics.track("error_occurred", {
          error_type: errorType,
          source: "openlibrary",
          message: `${response.status} ${response.statusText}`,
        });

        if (response.status === 503 || response.status === 429) {
          Analytics.track("error_occurred", {
            error_type: errorType,
            source: "openlibrary",
            message: `${response.status} ${response.statusText}`,
          });
          return null; // Allow the app to continue with Google Books data
        }
        throw new Error(
          `OpenLibrary API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await parseJsonSafe(response);

      // Check for API-level errors
      if (isErrorObject(data)) {
        // Graceful degradation for temporary unavailability
        if (
          data.error.includes("temporarily unavailable") ||
          data.error.includes("rate limit")
        ) {
          Analytics.track("error_occurred", {
            error_type: "rate_limit",
            source: "openlibrary",
            message: data.error,
          });
          Analytics.track("error_occurred", {
            error_type: "rate_limit",
            source: "openlibrary",
            message: data.error,
          });
          return null;
        }
        throw new Error(data.error);
      }

      // Track API timing
      Analytics.track("api_timing", {
        source: "openlibrary",
        endpoint: isIsbn ? "isbn_search" : "title_search",
        duration_ms: duration,
        success: true,
      });

      if (isIsbn) {
        const key = `ISBN:${query}`;
        return (data as Record<string, OpenLibraryBookData>)[key] || null;
      }
      return data as OpenLibraryBookData | OpenLibrarySearchResponse | null;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      Analytics.track("api_timing", {
        source: "openlibrary",
        endpoint: isIsbn ? "isbn_search" : "title_search",
        duration_ms: duration,
        success: false,
      });
      throw error;
    }
  }

  /**
   * Fetch book data from Library of Congress API
   * Gracefully handles timeouts and service unavailability
   * Priority source for LCC (Library of Congress Classification)
   */
  static async fetchLibraryOfCongress(
    isbn: string,
  ): Promise<LoCBookData | null> {
    const startTime = performance.now();
    const url = `${this.LOC_BASE}?q=${encodeURIComponent(isbn)}&fo=json&at=results`;

    try {
      const response = await fetch(url);
      const duration = Math.round(performance.now() - startTime);

      // Graceful degradation: Don't throw on errors, return null to allow fallback
      if (!response.ok) {
        const errorType =
          response.status === 503
            ? "api_503"
            : response.status === 429
              ? "rate_limit"
              : "unknown";
        Analytics.track("error_occurred", {
          error_type: errorType,
          source: "loc",
          message: `${response.status} ${response.statusText}`,
        });

        if (
          response.status === 503 ||
          response.status === 429 ||
          response.status === 404
        ) {
          Analytics.track("error_occurred", {
            error_type: errorType,
            source: "loc",
            message: `${response.status} ${response.statusText}`,
          });
          return null;
        }
        throw new Error(
          `Library of Congress API error: ${response.status} ${response.statusText}`,
        );
      }

      const data: LoCBookData = await response.json();

      // Validate that we have actual results
      if (!data.results || data.results.length === 0) {
        Analytics.track("error_occurred", {
          error_type: "unknown",
          source: "loc",
          message: `No results for ISBN ${isbn}`,
        });
        return null;
      }

      // Track API timing
      Analytics.track("api_timing", {
        source: "loc",
        endpoint: "isbn_search",
        duration_ms: duration,
        success: true,
      });

      return data;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      // Track timing even for failures
      Analytics.track("api_timing", {
        source: "loc",
        endpoint: "isbn_search",
        duration_ms: duration,
        success: false,
      });

      if (error instanceof Error && !error.message.includes("timeout")) {
        Analytics.track("error_occurred", {
          error_type: "network_error",
          source: "loc",
          message: error.message,
        });
      }

      // Silent failure - LoC can be slow or unavailable
      Analytics.track("error_occurred", {
        error_type: "network_error",
        source: "loc",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Fetch all three APIs in parallel with timeout and error handling
   * "Waterfall of Data" - Prioritizes best sources for each data type
   */
  static async fetchAll(
    query: string,
    isIsbn: boolean,
    googleLimit = 1,
    openLibraryLimit = 1,
  ): Promise<{
    google: GoogleBooksResponse | null;
    openlibrary: OpenLibraryBookData | OpenLibrarySearchResponse | null;
    loc: LoCBookData | null;
    errors: { google?: Error; openlibrary?: Error; loc?: Error };
  }> {
    const googleTimeout = 10000; // 10 seconds
    const openLibraryTimeout = 3000; // 3 seconds (fail fast, secondary source)
    const locTimeout = 5000; // 5 seconds (LoC can be slow, fail fast)

    // Execute all three API calls in parallel
    const googlePromise = this.withTimeout(
      this.fetchGoogleBooks(query, isIsbn, googleLimit),
      googleTimeout,
      "Google Books API timeout",
    );

    const openLibraryPromise = this.withTimeout(
      this.fetchOpenLibrary(query, isIsbn, openLibraryLimit),
      openLibraryTimeout,
      "OpenLibrary API timeout",
    );

    const locPromise = isIsbn
      ? this.withTimeout(
          this.fetchLibraryOfCongress(query),
          locTimeout,
          "Library of Congress API timeout",
        )
      : Promise.resolve(null); // LoC only supports ISBN search

    const [googleResult, openLibraryResult, locResult] =
      await Promise.allSettled([googlePromise, openLibraryPromise, locPromise]);

    const result = {
      google: null as GoogleBooksResponse | null,
      openlibrary: null as
        | OpenLibraryBookData
        | OpenLibrarySearchResponse
        | null,
      loc: null as LoCBookData | null,
      errors: {} as { google?: Error; openlibrary?: Error; loc?: Error },
    };

    if (googleResult.status === "fulfilled") {
      result.google = googleResult.value;
    } else {
      result.errors.google = googleResult.reason;
    }

    if (openLibraryResult.status === "fulfilled") {
      result.openlibrary = openLibraryResult.value;
    } else {
      result.errors.openlibrary = openLibraryResult.reason;
    }

    if (locResult.status === "fulfilled") {
      result.loc = locResult.value;
    } else {
      result.errors.loc = locResult.reason;
    }

    return result;
  }

  /**
   * Fetch book data from serverless API endpoint
   * Uses Cloudflare Workers + D1 + KV caching for optimal performance
   *
   * @param isbn - ISBN-10 or ISBN-13 identifier
   * @returns Merged book data with metadata from 3 sources
   */
  static async fetchFromServerless(isbn: string): Promise<MergedBookData> {
    const startTime = performance.now();
    const url = `/api/book/${encodeURIComponent(isbn)}`;

    try {
      const response = await fetch(url);
      const duration = Math.round(performance.now() - startTime);

      if (!response.ok) {
        const errorData = (await parseJsonSafe(response).catch(() => ({
          message: response.statusText,
        }))) as { message?: string };
        Analytics.track("error_occurred", {
          error_type: "serverless_api_error",
          source: "serverless",
          message: errorData.message || `HTTP ${response.status}`,
        });
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const data = (await parseJsonSafe(response)) as MergedBookData;

      // Track successful API call
      Analytics.track("api_timing", {
        source: "serverless",
        endpoint: "isbn_search",
        duration_ms: duration,
        success: true,
        cache_hit: response.headers.get("X-Cache") === "HIT",
      });

      return data;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      Analytics.track("api_timing", {
        source: "serverless",
        endpoint: "isbn_search",
        duration_ms: duration,
        success: false,
      });
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility - now delegates to fetchAll
   * @deprecated Use fetchAll() instead for 3-source support
   */
  static async fetchBoth(
    query: string,
    isIsbn: boolean,
    googleLimit = 1,
    openLibraryLimit = 1,
  ): Promise<{
    google: GoogleBooksResponse | null;
    openlibrary: OpenLibraryBookData | OpenLibrarySearchResponse | null;
    errors: { google?: Error; openlibrary?: Error };
  }> {
    const result = await this.fetchAll(
      query,
      isIsbn,
      googleLimit,
      openLibraryLimit,
    );

    return {
      google: result.google,
      openlibrary: result.openlibrary,
      errors: {
        google: result.errors.google,
        openlibrary: result.errors.openlibrary,
      },
    };
  }

  /**
   * Utility method to add timeout to promises
   */
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));
    });
  }
}

/**
 * Enhanced Cache with TTL and size limits
 */
export class ApiCache<T = unknown> {
  private cache = new Map<
    string,
    { data: T; timestamp: number; hits: number }
  >();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttlMs = 5 * 60 * 1000, maxSize = 100) {
    // 5 minutes TTL, 100 items max
    this.ttl = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      // Track cache miss
      const cacheType =
        this === googleCache
          ? "google"
          : this === openLibraryCache
            ? "openlibrary"
            : "loc";
      Analytics.track("cache_hit", {
        cache_type: cacheType,
        key: key.substring(0, 50), // Truncate for privacy
        is_isbn: isISBN(key.split(":")[0]),
      });
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and track cache hit
    entry.hits++;
    const cacheType =
      this === googleCache
        ? "google"
        : this === openLibraryCache
          ? "openlibrary"
          : "loc";
    Analytics.track("cache_hit", {
      cache_type: cacheType,
      key: key.substring(0, 50), // Truncate for privacy
      is_isbn: isISBN(key.split(":")[0]),
    });
    return entry.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp: now, hits: 0 });

    // Smart ISBN Prefetching: Cache both ISBN-10 and ISBN-13 variants
    // This prevents redundant API calls when scanning alternative barcodes
    if (isISBN(key)) {
      const sibling = getISBNSibling(key);
      if (sibling && !this.cache.has(sibling)) {
        // Store the same data under the sibling ISBN key
        this.cache.set(sibling, { data, timestamp: now, hits: 0 });
        const cacheType =
          this === googleCache
            ? "google"
            : this === openLibraryCache
              ? "openlibrary"
              : "loc";
        Analytics.track("cache_hit", {
          cache_type: cacheType,
          key: key.substring(0, 50),
          is_isbn: isISBN(key.split(":")[0]),
        });
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      totalHits: entries.reduce((sum, entry) => sum + entry.hits, 0),
      averageAge:
        entries.length > 0
          ? entries.reduce(
              (sum, entry) => sum + (Date.now() - entry.timestamp),
              0,
            ) / entries.length
          : 0,
    };
  }
}

// Global cache instances
export const googleCache = new ApiCache<
  GoogleBookItem["volumeInfo"] | GoogleBooksResponse | null
>();
export const openLibraryCache = new ApiCache<
  OpenLibraryBookData | OpenLibrarySearchResponse | null
>();
export const locCache = new ApiCache<LoCBookData | null>(5 * 60 * 1000, 100); // 5 minutes TTL, 100 items max
