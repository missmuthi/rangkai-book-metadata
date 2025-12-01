/**
 * High-Performance Book API Route
 *
 * Features:
 * - HTTP Cache (CDN) as First Layer (Free Tier Optimized)
 * - D1 Database as "Source of Truth" Cache
 * - 3-Source Data Fetching via metadata engine
 * - Background Writes (waitUntil pattern)
 * - Type-safe operations
 * - ETag Support (Conditional Requests)
 * - Input Validation (Zod)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import type { MergedBookData } from "$lib/types";
import { getRawDb, createScan } from "$lib/server/db";
import { getDrizzleDB } from "$lib/server/db/index";
import drizzleHelpers from "$lib/server/db/drizzle";
import { fetchBookByIsbn } from "$lib/server/metadata";
import { logger } from "$lib/server/logger";
import { isbnSchema } from "$lib/schemas";

/**
 * Generate a simple hash for ETag
 */
async function generateETag(data: unknown): Promise<string> {
  const text = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-1", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hashHex}"`;
}

/**
 * GET /api/book/[isbn]
 */
export const GET: RequestHandler = async ({
  params,
  platform,
  fetch,
  request,
  locals,
}) => {
  logger.debug("book_api_incoming_headers", {
    testHeader: request?.headers?.get("x-playwright-test-session"),
    cookies: request?.headers?.get("cookie"),
  });
  const { isbn } = params;
  const startTime = performance.now();

  // === Validation ===
  const validation = isbnSchema.safeParse(isbn);
  if (!validation.success) {
    throw error(400, {
      message: validation.error.issues[0].message,
    });
  }

  // === Authorization Check ===
  // CRITICAL: Ensure user is authenticated before saving to history
  if (!locals.session || !locals.user) {
    logger.warn("auth_unauthorized", {
      hasSession: !!locals.session,
      hasUser: !!locals.user,
      isbn,
      note: "Make sure to run with `npm run dev:wrangler` for D1 database access",
    });
    return json(
      { error: "Unauthorized: Please log in to save scans" },
      { status: 401 },
    );
  }

  // === STEP 1: HTTP Cache Check (CDN) ===
  // Use Cloudflare Cache API (caches.default)
  const cache = (globalThis as any).caches?.default;
  let cacheKey: Request | undefined;

  if (cache) {
    try {
      const cacheUrl = new URL(request.url);
      cacheKey = new Request(cacheUrl.toString(), request);
      const cachedResponse = await cache.match(cacheKey);

      if (cachedResponse) {
        logger.info("http_cache_hit", { isbn });
        return cachedResponse;
      }
    } catch (e) {
      logger.warn("http_cache_check_failed", { error: e });
    }
  }

  // === STEP 2: Check D1 (Source of Truth) ===
  const db = getRawDb(platform);
  const drizzleDb = getDrizzleDB(platform);
  let responseData: MergedBookData | null = null;
  let cacheHit = false;
  let source = "fetch";

  try {
    // Prefer Drizzle if available
    const existingScan = await drizzleHelpers.findAnyScanByIsbn(
      drizzleDb,
      isbn,
    );
    if (existingScan && existingScan.json_data) {
      responseData = JSON.parse(existingScan.json_data);
      cacheHit = true;
      source = "d1";
      logger.info("d1_cache_hit", { isbn });
    }
  } catch (e) {
    // Fallback to the existing D1 raw query if Drizzle isn't configured or test mocks intercept
    try {
      const existingScan = await db
        .prepare("SELECT json_data FROM scans WHERE isbn = ? LIMIT 1")
        .bind(isbn)
        .first<{ json_data: string }>();
      if (existingScan && existingScan.json_data) {
        responseData = JSON.parse(existingScan.json_data);
        cacheHit = true;
        source = "d1";
        logger.info("d1_cache_hit", { isbn });
      }
    } catch (err) {
      logger.error("d1_cache_check_failed", { error: err });
    }
    logger.error("d1_cache_check_failed", { error: e });
  }

  // === STEP 3: Fetch via Metadata Engine (if not in D1) ===
  if (!responseData) {
    const fetchStartTime = performance.now();
    let mergedData: MergedBookData;
    let sources: { google: boolean; openlibrary: boolean; loc: boolean };

    try {
      // Support multiple fetchBookByIsbn mock/signature variations in tests:
      // - new: fetchBookByIsbn(platform, fetchFn, isbn)
      // - old: fetchBookByIsbn(fetchFn, isbn)
      // - legacy: fetchBookByIsbn(isbn)
      if (
        typeof fetchBookByIsbn === "function" &&
        (fetchBookByIsbn as unknown as (...args: unknown[]) => unknown)
          .length >= 3
      ) {
        mergedData = await fetchBookByIsbn(platform, fetch, isbn);
      } else if (
        typeof fetchBookByIsbn === "function" &&
        (fetchBookByIsbn as unknown as (...args: unknown[]) => unknown)
          .length === 2
      ) {
        mergedData = await (
          fetchBookByIsbn as unknown as (
            fetchFn: typeof fetch,
            isbn: string,
          ) => Promise<MergedBookData>
        )(fetch, isbn);
      } else {
        mergedData = await (
          fetchBookByIsbn as unknown as (
            isbn: string,
          ) => Promise<MergedBookData>
        )(isbn);
      }

      // Get source status from the metadata
      const dataSource = mergedData?.dataSource || "";
      sources = {
        google: dataSource.includes("google"),
        openlibrary: dataSource.includes("openlibrary"),
        loc: dataSource.includes("loc"),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("metadata_fetch_failed", { isbn, error: errorMessage });
      throw error(404, {
        message: `Book not found: ${errorMessage}`,
      });
    }

    const fetchDuration = Math.round(performance.now() - fetchStartTime);
    logger.info("metadata_fetch_success", { isbn, duration: fetchDuration });

    // Add metadata
    responseData = {
      ...mergedData,
      meta: {
        isbn,
        sources,
        fetchDuration,
        totalDuration: Math.round(performance.now() - startTime),
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (!responseData) {
    // Should not happen given the flow, but typescript safeguard
    throw error(500, "Internal Server Error");
  }

  // === STEP 4: Save to Database (User History) ===
  // We ALWAYS attempt to save to the user's history, even if it was a D1 global hit.
  // This ensures that when a user scans a book, it appears in THEIR list, even if someone else scanned it before.
  // The createScan function handles UPSERT logic.
  if (platform?.env?.DB) {
    try {
      const title = responseData.title || "Unknown Title";
      const jsonData = JSON.stringify(responseData);

      let scanId;
      try {
        scanId = await drizzleHelpers.createScanDrizzle(
          drizzleDb,
          locals.user.id,
          isbn,
          title,
          jsonData,
          "draft",
          responseData.authors,
          responseData.subjects,
          responseData.ddc,
          responseData.lcc,
        );
      } catch (drizzleErr) {
        // Fallback to existing raw SQL function
        scanId = await createScan(
          db,
          locals.user.id,
          isbn,
          title,
          jsonData,
          "draft",
          responseData.authors,
          responseData.subjects,
          responseData.ddc,
          responseData.lcc,
        );
      }

      // Update response with the correct scan_id for THIS user
      responseData.scan_id = scanId;

      logger.info("scan_saved_to_history", {
        userId: locals.user.id,
        scanId,
        source,
      });
    } catch (dbError) {
      logger.error("db_write_failed", { error: dbError });
    }
  }

  // === STEP 5: ETag and Response ===
  const etag = await generateETag(responseData);
  const ifNoneMatch = request?.headers?.get("if-none-match");

  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Cache": cacheHit ? "D1-HIT" : "MISS",
      },
    });
  }

  const totalDuration = Math.round(performance.now() - startTime);

  const response = json(responseData, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=86400, s-maxage=86400", // 1 day
      "X-Cache": cacheHit ? "D1-HIT" : "MISS",
      "X-Response-Time": `${totalDuration}ms`,
      "X-Sources": responseData.meta
        ? JSON.stringify(responseData.meta.sources)
        : "cache",
    },
  });

  // === STEP 6: Save to HTTP Cache (Background) ===
  if (cache && cacheKey && platform?.context?.waitUntil) {
    platform.context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
};

/**
 * OPTIONS handler for CORS preflight
 */
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, If-None-Match, x-playwright-test-session",
      "Access-Control-Max-Age": "86400",
    },
  });
};
