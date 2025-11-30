/**
 * Google Books API adapter
 *
 * Handles all interactions with Google Books API.
 * Part of the metadata engine's source adapters.
 */

import type { GoogleBooksResponse } from "$lib/types";
import { Analytics } from "$lib/services/analytics";
import { logger, LogEvents } from "$lib/server/logger";
import { CircuitBreaker, withTimeout } from "$lib/server/utils/resilience";
import { getKV } from "$lib/server/cache";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch book data from Google Books API
 */
export async function fetchGoogleBooks(
  fetchFn: typeof fetch,
  query: string,
  isIsbn: boolean,
  maxResults = 1,
): Promise<GoogleBooksResponse | null> {
  const startTime = performance.now();
  const q = isIsbn ? `isbn:${query}` : `intitle:${query}`;
  const url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;

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
        source: "google",
        message: `${response.status} ${response.statusText}`,
      });
      throw new Error(
        `Google Books API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: GoogleBooksResponse = await response.json();

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
    logger.error(LogEvents.METADATA_FETCH_FAILED, {
      provider: "google_books",
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
export async function fetchGoogleBooksWithTimeout(
  platform: App.Platform | undefined,
  fetchFn: typeof fetch,
  query: string,
  isIsbn: boolean,
  maxResults = 1,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<GoogleBooksResponse | null> {
  const kv = getKV(platform);
  const breaker = new CircuitBreaker(kv, "google");

  if (await breaker.isOpen()) {
    console.warn("[GoogleBooks] Circuit open, skipping request");
    return null;
  }

  try {
    const result = await withTimeout(
      fetchGoogleBooks(fetchFn, query, isIsbn, maxResults),
      timeoutMs,
      "Google Books API timeout",
    );
    await breaker.success();
    return result;
  } catch (error) {
    await breaker.failure();
    console.error("[GoogleBooks] Request failed:", error);
    return null;
  }
}
