/**
 * OpenLibrary API adapter
 *
 * Handles all interactions with OpenLibrary API via proxy.
 * Part of the metadata engine's source adapters.
 */

import type {
  OpenLibraryBookData,
  OpenLibrarySearchResponse,
} from "$lib/types";
import { Analytics } from "$lib/services/analytics";
import { logger, LogEvents } from "$lib/server/logger";
import { CircuitBreaker, withTimeout } from "$lib/server/utils/resilience";
import { getKV } from "$lib/server/cache";

// Platform object is needed to get KV, so we need to inject it or handle it in the caller.
// The current fetchOpenLibrary doesn't take platform.
// For now, we will create the CircuitBreaker inside if we can access platform, but these functions are pure.
// The caller (src/lib/server/metadata/index.ts) probably needs to pass the platform or KV.
// Let's check src/lib/server/metadata/index.ts again.

// Wait, the current `fetchBookByIsbn` implementation in `index.ts` only takes `fetch` and `isbn`.
// `src/routes/api/book/[isbn]/+server.ts` calls `fetchBookByIsbn(fetch, isbn)`.
// It does NOT pass platform.
// However, `src/routes/api/book/[isbn]/+server.ts` HAS `platform`.
// I should update `fetchBookByIsbn` to accept `platform` or `KVNamespace`.
// This is a cascading change.

// For this step, I will assume I can modify the signature of `fetchOpenLibraryWithTimeout` to accept KV.
// But first I need to check `src/lib/server/metadata/index.ts`.

const OPENLIBRARY_PROXY = "/api/openlibrary";
const DEFAULT_TIMEOUT = 3000; // 3 seconds (fail fast, secondary source)

/**
 * Fetch book data from OpenLibrary API (via proxy)
 * Gracefully handles rate limiting and service unavailability
 */
export async function fetchOpenLibrary(
  query: string,
  isIsbn: boolean,
  limit = 1,
): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
  const startTime = performance.now();
  const url = `${OPENLIBRARY_PROXY}?q=${encodeURIComponent(query)}&isbn=${isIsbn}&limit=${limit}`;

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
        source: "openlibrary",
        message: `${response.status} ${response.statusText}`,
      });

      if (response.status === 503 || response.status === 429) {
        const reason = `${response.status} ${response.statusText}`;
        logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
          provider: "openlibrary",
          status: response.status,
          fallback: "google_books",
        });
        // Track in analytics (typed)
        Analytics.track("metadata_source_degraded", {
          provider: "openlibrary",
          status: response.status,
          reason,
          fallback: "google_books",
          query: isIsbn ? undefined : query,
        });
        // We should throw to trigger circuit breaker failure counting
        throw new Error(
          `OpenLibrary API error: ${response.status} ${response.statusText}`,
        );
      }
      throw new Error(
        `OpenLibrary API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (data.error) {
      if (
        data.error.includes("temporarily unavailable") ||
        data.error.includes("rate limit")
      ) {
        Analytics.track("error_occurred", {
          error_type: "rate_limit",
          source: "openlibrary",
          message: data.error,
        });
        logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
          provider: "openlibrary",
          reason: "temporarily_unavailable",
          fallback: "google_books",
        });
        Analytics.track("metadata_source_degraded", {
          provider: "openlibrary",
          reason: "temporarily_unavailable",
          fallback: "google_books",
        });
        throw new Error(data.error);
      }
      throw new Error(data.error);
    }

    Analytics.track("api_timing", {
      source: "openlibrary",
      endpoint: isIsbn ? "isbn_search" : "title_search",
      duration_ms: duration,
      success: true,
    });

    if (isIsbn) {
      const key = `ISBN:${query}`;
      return data[key] || null;
    }

    return data;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    Analytics.track("api_timing", {
      source: "openlibrary",
      endpoint: isIsbn ? "isbn_search" : "title_search",
      duration_ms: duration,
      success: false,
    });
    logger.error(LogEvents.METADATA_FETCH_FAILED, {
      provider: "openlibrary",
      query,
      isIsbn,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Fetch with timeout wrapper and circuit breaker
 */
export async function fetchOpenLibraryWithTimeout(
  platform: App.Platform | undefined, // Added platform
  query: string,
  isIsbn: boolean,
  limit = 1,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
  const kv = getKV(platform);
  const breaker = new CircuitBreaker(kv, "openlibrary");

  if (await breaker.isOpen()) {
    logger.warn("openlibrary_circuit_open", { query, isIsbn });
    return null;
  }

  try {
    const result = await withTimeout(
      fetchOpenLibrary(query, isIsbn, limit),
      timeoutMs,
      "OpenLibrary API timeout",
    );
    await breaker.success();
    return result;
  } catch (error) {
    await breaker.failure();
    // Return null on failure instead of throwing, to allow other sources to succeed
    // But log the error
    logger.error("openlibrary_request_failed", {
      query,
      isIsbn,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
