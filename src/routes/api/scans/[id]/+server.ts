import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import type { MergedBookData } from "$lib/types";
import { logger } from "$lib/server/logger";
import { bookSchema } from "$lib/schemas";

/**
 * PATCH /api/scans/[id]
 *
 * Update an existing scan's json_data by ID.
 * Enforces Row Level Security: users can only update their own scans.
 */
export const PATCH: RequestHandler = async ({
  params,
  request,
  locals,
  platform,
}) => {
  // Check authentication
  if (!locals.session || !locals.user) {
    throw error(401, "Unauthorized");
  }

  const userId = locals.user.id;
  const scanId = parseInt(params.id, 10);

  if (isNaN(scanId)) {
    throw error(400, "Invalid scan ID");
  }

  // Check D1 database binding
  if (!platform?.env?.DB) {
    logger.error("scans_api_db_not_available", {});
    throw error(503, "Database not available");
  }

  const db = platform.env.DB;

  try {
    const rawBody = await request.json();
    // Validate that the update is valid Partial<MergedBookData> using the schema
    const parseResult = bookSchema.partial().safeParse(rawBody);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((issue) => issue.message)
        .join(", ");
      throw error(400, `Invalid update data: ${errorMessage}`);
    }
    const body = parseResult.data;

    if (!body || Object.keys(body).length === 0) {
      throw error(400, "No update data provided");
    }

    // First, verify the scan exists and belongs to this user (RLS)
    const existing = await db
      .prepare(
        `
			SELECT id, user_id FROM scans WHERE id = ?
		`,
      )
      .bind(scanId)
      .first<{ id: number; user_id: string }>();

    if (!existing) {
      throw error(404, "Scan not found");
    }

    if (existing.user_id !== userId) {
      logger.warn("scans_api_update_forbidden_attempt", {
        userId,
        scanId,
        ownerId: existing.user_id,
      });
      throw error(403, "Forbidden: You do not own this scan");
    }

    // Prepare update data
    const jsonData = JSON.stringify(body);
    const title = body.title || "Untitled";

    // Update the scan
    const result = await db
      .prepare(
        `
			UPDATE scans 
			SET json_data = ?, title = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND user_id = ?
		`,
      )
      .bind(jsonData, title, scanId, userId)
      .run();

    if (result.meta.changes === 0) {
      throw error(500, "Failed to update scan");
    }

    logger.info("scans_api_scan_updated", { scanId, userId });

    return json({
      success: true,
      scan_id: scanId,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    // Re-throw SvelteKit errors
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    logger.error("scans_api_update_error", { err });
    throw error(500, "Internal server error");
  }
};

/**
 * GET /api/scans/[id]
 *
 * Retrieve a specific scan by ID.
 * Enforces Row Level Security: users can only view their own scans.
 */
export const GET: RequestHandler = async ({ params, locals, platform }) => {
  // Check authentication
  if (!locals.session || !locals.user) {
    throw error(401, "Unauthorized");
  }

  const userId = locals.user.id;
  const scanId = parseInt(params.id, 10);

  if (isNaN(scanId)) {
    throw error(400, "Invalid scan ID");
  }

  // Check D1 database binding
  if (!platform?.env?.DB) {
    throw error(503, "Database not available");
  }

  const db = platform.env.DB;

  try {
    const scan = await db
      .prepare(
        `
            SELECT id, user_id, isbn, title, json_data, status, created_at, updated_at, is_ai_enhanced, enhanced_at
			FROM scans 
			WHERE id = ? AND user_id = ?
		`,
      )
      .bind(scanId, userId)
      .first<{
        id: number;
        user_id: string;
        isbn: string;
        title: string;
        json_data: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>();

    if (!scan) {
      throw error(404, "Scan not found");
    }

    // Parse json_data
    let bookData: MergedBookData | null = null;
    try {
      bookData = JSON.parse(scan.json_data);
    } catch {
      logger.warn("scans_api_json_parse_failed", { scanId });
    }

    return json({
      id: scan.id,
      isbn: scan.isbn,
      title: scan.title,
      status: scan.status,
      created_at: scan.created_at,
      updated_at: scan.updated_at,
      is_ai_enhanced: !!scan.is_ai_enhanced,
      enhanced_at: scan.enhanced_at ? Number(scan.enhanced_at) : null,
      data: bookData,
    });
  } catch (err) {
    // Re-throw SvelteKit errors
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    logger.error("scans_api_fetch_error", { err });
    throw error(500, "Internal server error");
  }
};

/**
 * DELETE /api/scans/[id]
 *
 * Delete a specific scan by ID.
 * Enforces Row Level Security: users can only delete their own scans.
 */
export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  // Check authentication
  if (!locals.session || !locals.user) {
    throw error(401, "Unauthorized");
  }

  const userId = locals.user.id;
  const scanId = parseInt(params.id, 10);

  if (isNaN(scanId)) {
    throw error(400, "Invalid scan ID");
  }

  // Check D1 database binding
  if (!platform?.env?.DB) {
    throw error(503, "Database not available");
  }

  const db = platform.env.DB;

  try {
    // Delete only if user owns the scan (RLS)
    const result = await db
      .prepare(
        `
			DELETE FROM scans WHERE id = ? AND user_id = ?
		`,
      )
      .bind(scanId, userId)
      .run();

    if (result.meta.changes === 0) {
      throw error(404, "Scan not found or already deleted");
    }

    logger.info("scans_api_scan_deleted", { scanId, userId });

    return json({
      success: true,
      deleted_id: scanId,
    });
  } catch (err) {
    // Re-throw SvelteKit errors
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    logger.error("scans_api_delete_error", { err });
    throw error(500, "Internal server error");
  }
};
