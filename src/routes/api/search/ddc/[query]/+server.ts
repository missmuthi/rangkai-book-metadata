/**
 * Smart Search API - Search by DDC Classification
 *
 * GET /api/search/ddc/[query]?limit=50
 *
 * Searches for books by Dewey Decimal Classification (prefix match)
 * Examples: /api/search/ddc/005 (Computer Programming)
 *           /api/search/ddc/510 (Mathematics)
 *           /api/search/ddc/800 (Literature)
 *
 * Returns user-scoped results with full metadata
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireSession } from "$lib/server/auth";
import { getDB, searchUserScansByDDC } from "$lib/server/db";
import { logger } from "$lib/server/logger";

export const GET: RequestHandler = async (event) => {
  // Require authentication
  await requireSession(event);

  const userId = event.locals.user!.id;
  const ddcQuery = event.params.query;

  // Get query parameters
  const limit = Math.min(
    parseInt(event.url.searchParams.get("limit") || "50"),
    100, // Max 100 results
  );

  if (!ddcQuery || ddcQuery.trim().length < 1) {
    throw error(400, "DDC query must be at least 1 character");
  }

  // Validate DDC format (should be numeric)
  if (!/^\d+(\.\d+)?$/.test(ddcQuery.trim())) {
    throw error(400, "DDC query must be numeric (e.g., '005', '510.1')");
  }

  try {
    const db = getDB(event.platform);
    const results = await searchUserScansByDDC(db, userId, ddcQuery.trim(), limit);

    // Transform results to include parsed metadata
    const transformedResults = results.map((scan) => {
      let metadata;
      try {
        metadata = JSON.parse(scan.json_data);
      } catch {
        metadata = { title: scan.title, error: "Invalid JSON data" };
      }

      return {
        id: scan.id,
        isbn: scan.isbn,
        title: scan.title,
        authors: scan.authors,
        subjects: scan.subjects,
        ddc: scan.ddc,
        lcc: scan.lcc,
        status: scan.status,
        created_at: scan.created_at,
        metadata,
      };
    });

    return json({
      query: ddcQuery.trim(),
      type: "ddc",
      total: transformedResults.length,
      results: transformedResults,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("search_ddc_failed", {
      userId,
      query: ddcQuery,
      error: errorMessage,
    });
    throw error(500, `DDC search failed: ${errorMessage}`);
  }
};