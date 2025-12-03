/**
 * Scans History Versioning Utilities
 *
 * Provides helper functions for creating and managing scan snapshots
 * for audit and recovery purposes.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { logger } from "$lib/server/logger";

export interface ScanSnapshot {
  scan_id: number;
  user_id: string;
  isbn: string;
  title: string | null;
  json_data: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  ai_log: string | null;
  is_ai_enhanced: number | null;
  enhanced_at: number | null;
}

/**
 * Create a snapshot of a scan before updating it
 *
 * @param db - D1 Database instance
 * @param scanId - ID of the scan to snapshot
 * @param requestId - Optional request ID for logging
 * @returns The version number of the created snapshot, or null on failure
 */
export async function createScanSnapshot(
  db: D1Database,
  scanId: number,
  requestId?: string,
): Promise<number | null> {
  try {
    // 1. Fetch the current scan data
    const existingScan = await db
      .prepare(`SELECT * FROM scans WHERE id = ? LIMIT 1`)
      .bind(scanId)
      .first<ScanSnapshot>();

    if (!existingScan) {
      logger.warn("scan_snapshot_scan_not_found", { scanId, requestId });
      return null;
    }

    // 2. Count existing history entries to determine next version
    const historyCount = await db
      .prepare(`SELECT COUNT(*) as count FROM scans_history WHERE scan_id = ?`)
      .bind(scanId)
      .first<{ count: number }>();

    const nextVersion = (historyCount?.count ?? 0) + 1;
    const snapshotAt = Date.now();

    // 3. Insert snapshot into history table
    await db
      .prepare(
        `
        INSERT INTO scans_history (
          scan_id, version, snapshot_at,
          user_id, isbn, title, json_data, status,
          created_at, updated_at, ai_log, is_ai_enhanced, enhanced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        scanId,
        nextVersion,
        snapshotAt,
        existingScan.user_id,
        existingScan.isbn,
        existingScan.title,
        existingScan.json_data,
        existingScan.status,
        existingScan.created_at,
        existingScan.updated_at,
        existingScan.ai_log,
        existingScan.is_ai_enhanced,
        existingScan.enhanced_at,
      )
      .run();

    logger.info("scan_snapshot_created", {
      scanId,
      version: nextVersion,
      requestId,
    });

    return nextVersion;
  } catch (error) {
    logger.error("scan_snapshot_failed", {
      error: error instanceof Error ? error.message : String(error),
      scanId,
      requestId,
    });
    return null;
  }
}

/**
 * Get all versions of a scan
 *
 * @param db - D1 Database instance
 * @param scanId - ID of the scan
 * @returns Array of all snapshot versions, ordered by version DESC
 */
export async function getScanHistory(
  db: D1Database,
  scanId: number,
): Promise<ScanSnapshot[]> {
  try {
    const result = await db
      .prepare(
        `
        SELECT * FROM scans_history 
        WHERE scan_id = ? 
        ORDER BY version DESC
      `,
      )
      .bind(scanId)
      .all<ScanSnapshot>();

    return result.results || [];
  } catch (error) {
    logger.error("get_scan_history_failed", {
      error: error instanceof Error ? error.message : String(error),
      scanId,
    });
    return [];
  }
}

/**
 * Restore a scan to a previous version
 *
 * @param db - D1 Database instance
 * @param scanId - ID of the scan to restore
 * @param version - Version number to restore to
 * @param requestId - Optional request ID for logging
 * @returns true if successful, false otherwise
 */
export async function restoreScanVersion(
  db: D1Database,
  scanId: number,
  version: number,
  requestId?: string,
): Promise<boolean> {
  try {
    // 1. Get the snapshot
    const snapshot = await db
      .prepare(
        `
        SELECT * FROM scans_history 
        WHERE scan_id = ? AND version = ? 
        LIMIT 1
      `,
      )
      .bind(scanId, version)
      .first<ScanSnapshot>();

    if (!snapshot) {
      logger.warn("scan_restore_version_not_found", {
        scanId,
        version,
        requestId,
      });
      return false;
    }

    // 2. Create a snapshot of current state before restoring
    await createScanSnapshot(db, scanId, requestId);

    // 3. Restore the scan to the snapshot state
    await db
      .prepare(
        `
        UPDATE scans 
        SET title = ?, json_data = ?, status = ?,
            ai_log = ?, is_ai_enhanced = ?, enhanced_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      )
      .bind(
        snapshot.title,
        snapshot.json_data,
        snapshot.status,
        snapshot.ai_log,
        snapshot.is_ai_enhanced,
        snapshot.enhanced_at,
        scanId,
      )
      .run();

    logger.info("scan_restored_to_version", {
      scanId,
      restoredToVersion: version,
      requestId,
    });

    return true;
  } catch (error) {
    logger.error("scan_restore_failed", {
      error: error instanceof Error ? error.message : String(error),
      scanId,
      version,
      requestId,
    });
    return false;
  }
}
