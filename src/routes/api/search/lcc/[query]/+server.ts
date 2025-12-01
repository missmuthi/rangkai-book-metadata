/**
 * Smart Search API - Search by LCC Classification
 *
 * GET /api/search/lcc/[query]?limit=50
 *
 * Searches for books by Library of Congress Classification (prefix match)
 * Examples: /api/search/lcc/QA76 (Computer Science)
 *           /api/search/lcc/P (Language and Literature)
 *           /api/search/lcc/H (Social Sciences)
 *
 * Returns user-scoped results with full metadata
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireSession } from "$lib/server/auth";
import { getDB, searchUserScansByLCC } from "$lib/server/db";
import { logger } from "$lib/server/logger";

export const GET: RequestHandler = async (event) => {
  // Require authentication
  await requireSession(event);

  const userId = event.locals.user!.id;
  const lccQuery = event.params.query;

  // Get query parameters
  const limit = Math.min(
    parseInt(event.url.searchParams.get("limit") || "50"),
    100, // Max 100 results
  );

  if (!lccQuery || lccQuery.trim().length < 1) {
    throw error(400, "LCC query must be at least 1 character");
  }

  // Validate LCC format (should start with letters, optionally followed by numbers)
  if (!/^[A-Z]+[A-Z0-9]*(\.[A-Z0-9]+)?$/.test(lccQuery.trim().toUpperCase())) {
    throw error(
      400,
      "LCC query must be in valid format (e.g., 'QA76', 'P', 'H62')",
    );
  }

  try {
    const db = getDB(event.platform);
    const results = await searchUserScansByLCC(
      db,
      userId,
      lccQuery.trim().toUpperCase(),
      limit,
    );

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
      query: lccQuery.trim().toUpperCase(),
      type: "lcc",
      total: transformedResults.length,
      results: transformedResults,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("search_lcc_failed", {
      userId,
      query: lccQuery,
      error: errorMessage,
    });
    throw error(500, `LCC search failed: ${errorMessage}`);
  }
};
