/**
 * Smart Search API - Search by Author
 *
 * GET /api/search/author/[query]?limit=50
 *
 * Searches for books by author name (partial match, case-insensitive)
 * Returns user-scoped results with full metadata
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireSession } from "$lib/server/auth";
import { getDB, searchUserScansByAuthor } from "$lib/server/db";
import { logger } from "$lib/server/logger";

export const GET: RequestHandler = async (event) => {
  // Require authentication
  await requireSession(event);

  const userId = event.locals.user!.id;
  const authorQuery = event.params.query;

  // Get query parameters
  const limit = Math.min(
    parseInt(event.url.searchParams.get("limit") || "50"),
    100, // Max 100 results
  );

  if (!authorQuery || authorQuery.trim().length < 2) {
    throw error(400, "Author query must be at least 2 characters");
  }

  try {
    const db = getDB(event.platform);
    const results = await searchUserScansByAuthor(db, userId, authorQuery.trim(), limit);

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
      query: authorQuery.trim(),
      type: "author",
      total: transformedResults.length,
      results: transformedResults,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("search_author_failed", {
      userId,
      query: authorQuery,
      error: errorMessage,
    });
    throw error(500, `Author search failed: ${errorMessage}`);
  }
};