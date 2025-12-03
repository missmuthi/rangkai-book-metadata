/**
 * Scan History API Endpoint
 *
 * GET /api/scans/[id]/history - Get version history for a scan
 * POST /api/scans/[id]/history/restore - Restore a scan to a previous version
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { logger } from "$lib/server/logger";
import { getScanHistory, restoreScanVersion } from "$lib/server/versioning";

/**
 * GET - Retrieve version history for a scan
 */
export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.session || !locals.user) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  const scanId = parseInt(params.id);
  if (isNaN(scanId)) {
    return json({ error: "Invalid scan ID" }, { status: 400 });
  }

  const DB = platform?.env?.DB;
  if (!DB) {
    return json({ error: "Database unavailable" }, { status: 500 });
  }

  try {
    // Verify ownership
    const scan = await DB.prepare(
      `SELECT id, user_id FROM scans WHERE id = ? LIMIT 1`,
    )
      .bind(scanId)
      .first<{ id: number; user_id: string }>();

    if (!scan) {
      return json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.user_id !== locals.user.id) {
      return json({ error: "Access denied" }, { status: 403 });
    }

    // Get history
    const history = await getScanHistory(DB, scanId);

    logger.info("scan_history_retrieved", {
      scanId,
      versionsCount: history.length,
      userId: locals.user.id,
    });

    return json({
      scan_id: scanId,
      versions: history,
      total_versions: history.length,
    });
  } catch (error) {
    logger.error("scan_history_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
      scanId,
    });
    return json({ error: "Failed to retrieve history" }, { status: 500 });
  }
};

/**
 * POST - Restore a scan to a previous version
 * Body: { version: number }
 */
export const POST: RequestHandler = async ({
  params,
  request,
  locals,
  platform,
}) => {
  if (!locals.session || !locals.user) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  const scanId = parseInt(params.id);
  if (isNaN(scanId)) {
    return json({ error: "Invalid scan ID" }, { status: 400 });
  }

  const DB = platform?.env?.DB;
  if (!DB) {
    return json({ error: "Database unavailable" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const version = parseInt(body.version);

    if (isNaN(version) || version < 1) {
      return json({ error: "Invalid version number" }, { status: 400 });
    }

    // Verify ownership
    const scan = await DB.prepare(
      `SELECT id, user_id FROM scans WHERE id = ? LIMIT 1`,
    )
      .bind(scanId)
      .first<{ id: number; user_id: string }>();

    if (!scan) {
      return json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.user_id !== locals.user.id) {
      return json({ error: "Access denied" }, { status: 403 });
    }

    // Restore to version
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const success = await restoreScanVersion(DB, scanId, version, requestId);

    if (!success) {
      return json(
        { error: "Failed to restore version. Version may not exist." },
        { status: 400 },
      );
    }

    logger.info("scan_restored_via_api", {
      scanId,
      version,
      userId: locals.user.id,
      requestId,
    });

    return json({
      success: true,
      scan_id: scanId,
      restored_to_version: version,
      message: `Successfully restored scan to version ${version}`,
    });
  } catch (error) {
    logger.error("scan_restore_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
      scanId,
    });
    return json({ error: "Failed to restore scan" }, { status: 500 });
  }
};
