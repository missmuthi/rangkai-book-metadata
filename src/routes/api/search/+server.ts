/**
 * Smart Search API - General Search
 *
 * GET /api/search?q=query&limit=50
 *
 * Searches across title, authors, subjects, and ISBN
 * Returns user-scoped results with full metadata
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireSession } from "$lib/server/auth";
import { getDB, searchUserScansGeneral } from "$lib/server/db";
import { logger } from "$lib/server/logger";

export const GET: RequestHandler = async (event) => {
  // Require authentication
  await requireSession(event);

  const userId = event.locals.user!.id;

  // Get query parameters
  const query = event.url.searchParams.get("q");
  const limit = Math.min(
    parseInt(event.url.searchParams.get("limit") || "50"),
    100, // Max 100 results
  );

  if (!query || query.trim().length < 2) {
    throw error(400, "Search query must be at least 2 characters");
  }

  try {
    const db = getDB(event.platform);
    const results = await searchUserScansGeneral(db, userId, query.trim(), limit);

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
      query: query.trim(),
      total: transformedResults.length,
      results: transformedResults,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("search_general_failed", {
      userId,
      query,
      error: errorMessage,
    });
    throw error(500, `Search failed: ${errorMessage}`);
  }
};