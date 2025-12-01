/**
 * Library of Congress API adapter
 *
 * Handles all interactions with Library of Congress API.
 * Part of the metadata engine's source adapters.
 * Priority source for LCC (Library of Congress Classification).
 */

import type { LoCBookData } from "$lib/types";
import { Analytics } from "$lib/services/analytics";
import { logger, LogEvents } from "$lib/server/logger";
import { CircuitBreaker, withTimeout } from "$lib/server/utils/resilience";
import { getKV } from "$lib/server/cache";

const LOC_BASE = "https://www.loc.gov/books/";
const DEFAULT_TIMEOUT = 5000; // 5 seconds (LoC can be slow, fail fast)

/**
 * Fetch book data from Library of Congress API
 */
export async function fetchLibraryOfCongress(
  fetchFn: typeof fetch,
  isbn: string,
): Promise<LoCBookData | null> {
  const startTime = performance.now();
  const url = `${LOC_BASE}?q=${encodeURIComponent(isbn)}&fo=json&at=results`;

  try {
    const response = await fetchFn(url);
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
        source: "loc",
        message: `${response.status} ${response.statusText}`,
      });

      if (
        response.status === 503 ||
        response.status === 429 ||
        response.status === 404
      ) {
        const reason = `${response.status} ${response.statusText}`;
        logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
          provider: "loc",
          status: response.status,
          fallback: "other_sources",
        });
        Analytics.track("metadata_source_degraded", {
          provider: "loc",
          status: response.status,
          reason,
          fallback: "other_sources",
          isbn,
        });
        throw new Error(
          `Library of Congress API error: ${response.status} ${response.statusText}`,
        );
      }
      throw new Error(
        `Library of Congress API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: LoCBookData = await response.json();

    // Validate that we have actual results
    if (!data.results || data.results.length === 0) {
      logger.debug("loc_no_results", { isbn });
      return null;
    }

    Analytics.track("api_timing", {
      source: "loc",
      endpoint: "isbn_search",
      duration_ms: duration,
      success: true,
    });

    return data;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);

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

    logger.warn(LogEvents.METADATA_FETCH_FAILED, {
      provider: "loc",
      isbn,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Fetch with timeout wrapper and circuit breaker
 */
export async function fetchLibraryOfCongressWithTimeout(
  platform: App.Platform | undefined,
  fetchFn: typeof fetch,
  isbn: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<LoCBookData | null> {
  const kv = getKV(platform);
  const breaker = new CircuitBreaker(kv, "loc");

  if (await breaker.isOpen()) {
    logger.warn("loc_circuit_open", { isbn });
    return null;
  }

  try {
    const result = await withTimeout(
      fetchLibraryOfCongress(fetchFn, isbn),
      timeoutMs,
      "Library of Congress API timeout",
    );
    await breaker.success();
    return result;
  } catch (error) {
    await breaker.failure();
    logger.error("loc_request_failed", {
      isbn,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
