/**
 * Google Books API adapter
 *
 * Handles all interactions with Google Books API.
 * Part of the metadata engine's source adapters.
 */

import type { KVNamespace } from "../../types";
import type { GoogleBooksResponse } from "$lib/types";
import { Analytics } from "$lib/services/analytics";
import { logger, LogEvents } from "$lib/server/logger";
import { CircuitBreaker, withTimeout } from "$lib/server/utils/resilience";
import { parseJsonSafe } from "$lib/utils/json";
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
  apiKey?: string,
  isFallback = false,
): Promise<GoogleBooksResponse | null> {
  const startTime = performance.now();
  const q = isIsbn ? `isbn:${query}` : `intitle:${query}`;
  let url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;

  // Add API key if available (Hybrid Fetch Strategy)
  if (apiKey) {
    url += `&key=${apiKey}`;
  }

  const authType = apiKey ? "Authenticated" : "Public";
  logger.info("google_books_fetch", {
    query: isIsbn ? undefined : query,
    isIsbn,
    authType,
    isFallback,
  });

  try {
    const response = await fetchFn(url);
    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let errorType: string = "unknown";
      if (response.status === 503) errorType = "api_503";
      else if (response.status === 429) errorType = "rate_limit";
      else if (response.status === 403) {
        // Granular Quota Tracking
        errorType = apiKey ? "quota_exceeded_auth" : "quota_exceeded_public";
      }

      Analytics.track("error_occurred", {
        error_type: errorType,
        source: "google",
        message: `${response.status} ${response.statusText}`,
        authType,
      });
      if (response.status === 503 || response.status === 429) {
        logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
          provider: "google",
          status: response.status,
          fallback: "openlibrary",
        });
        Analytics.track("metadata_source_degraded", {
          provider: "google",
          status: response.status,
          reason: `${response.status} ${response.statusText}`,
          fallback: "openlibrary",
          query: isIsbn ? undefined : query,
        });
      }

      const err = new Error(
        `Google Books API error: ${response.status} ${response.statusText}`,
      ) as Error & { status?: number };
      // Attach status for callers to make decisions (e.g., retry without API key)
      err.status = response.status;
      throw err;
    }

    const data = (await parseJsonSafe(response)) as GoogleBooksResponse;

    Analytics.track("api_timing", {
      source: "google",
      endpoint: isIsbn ? "isbn_search" : "title_search",
      duration_ms: duration,
      success: true,
      authType,
      fallback_triggered: isFallback,
    });

    return data;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    Analytics.track("api_timing", {
      source: "google",
      endpoint: isIsbn ? "isbn_search" : "title_search",
      duration_ms: duration,
      success: false,
      authType,
    });
    logger.error(LogEvents.METADATA_FETCH_FAILED, {
      provider: "google_books",
      query,
      isIsbn,
      error: error instanceof Error ? error.message : "Unknown error",
      authType,
    });
    throw error;
  }
}

/**
 * Fetch with timeout wrapper and circuit breaker
 * Implements Hybrid Fetch Strategy:
 * 1. Try with API key if available (higher limits)
 * 2. Fallback to public endpoint on 403 quota exceeded
 */
export async function fetchGoogleBooksWithTimeout(
  platform: App.Platform | undefined,
  fetchFn: typeof fetch,
  query: string,
  isIsbn: boolean,
  maxResults = 1,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<GoogleBooksResponse | null> {
  const kv = getKV(platform) as KVNamespace | null;
  const breaker = new CircuitBreaker(kv, "google");

  if (await breaker.isOpen()) {
    logger.warn("google_books_circuit_open", { query, isIsbn });
    return null;
  }

  // Get API key from platform environment (optional)
  const apiKey = platform?.env?.GOOGLE_BOOKS_API_KEY as string | undefined;

  try {
    // First attempt: with API key if available
    const result = await withTimeout(
      fetchGoogleBooks(fetchFn, query, isIsbn, maxResults, apiKey),
      timeoutMs,
      "Google Books API timeout",
    );
    await breaker.success();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus =
      (error as Error & { status?: number })?.status ??
      (errorMessage.includes("403") ? 403 : undefined);

    // Hybrid Fetch Fallback: If authenticated request failed with 403 quota exceeded,
    // retry without API key (using public IP quota)
    const disableFallback =
      platform?.env?.DISABLE_GOOGLE_BOOKS_FALLBACK === "true";

    if (apiKey && errorStatus === 403 && !disableFallback) {
      logger.warn("google_books_quota_fallback", {
        query,
        isIsbn,
        message: "API key quota exceeded, retrying with public endpoint",
      });
      Analytics.track("metadata_source_degraded", {
        provider: "google",
        status: 403,
        reason: "quota_exceeded",
        fallback: "public_endpoint",
        query: isIsbn ? undefined : query,
      });

      try {
        const fallbackResult = await withTimeout(
          fetchGoogleBooks(
            fetchFn,
            query,
            isIsbn,
            maxResults,
            undefined,
            true, // isFallback
          ),
          timeoutMs,
          "Google Books API timeout (fallback)",
        );
        await breaker.success();
        return fallbackResult;
      } catch (fallbackError) {
        await breaker.failure();
        logger.error("google_books_fallback_failed", {
          query,
          isIsbn,
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });
        return null;
      }
    }

    // No fallback applicable or fallback not attempted
    await breaker.failure();
    logger.error("google_books_request_failed", {
      query,
      isIsbn,
      error: errorMessage,
    });
    return null;
  }
}
