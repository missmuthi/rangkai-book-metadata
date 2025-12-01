/**
 * Smart Search API - Search by Subject
 *
 * GET /api/search/subject/[query]?limit=50
 *
 * Searches for books by subject/category (partial match, case-insensitive)
 * Returns user-scoped results with full metadata
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireSession } from "$lib/server/auth";
import { getDB, searchUserScansBySubject } from "$lib/server/db";
import { logger } from "$lib/server/logger";

export const GET: RequestHandler = async (event) => {
  // Require authentication
  await requireSession(event);

  const userId = event.locals.user!.id;
  const subjectQuery = event.params.query;

  // Get query parameters
  const limit = Math.min(
    parseInt(event.url.searchParams.get("limit") || "50"),
    100, // Max 100 results
  );

  if (!subjectQuery || subjectQuery.trim().length < 2) {
    throw error(400, "Subject query must be at least 2 characters");
  }

  try {
    const db = getDB(event.platform);
    const results = await searchUserScansBySubject(
      db,
      userId,
      subjectQuery.trim(),
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
      query: subjectQuery.trim(),
      type: "subject",
      total: transformedResults.length,
      results: transformedResults,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("search_subject_failed", {
      userId,
      query: subjectQuery,
      error: errorMessage,
    });
    throw error(500, `Subject search failed: ${errorMessage}`);
  }
};
