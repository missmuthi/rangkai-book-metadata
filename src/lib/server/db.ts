/**
 * Database (D1) operations layer
 *
 * Single source of truth for D1 database queries.
 * Provides typed, reusable query helpers for all D1 operations.
 */

import type { D1Database, Scan, User } from "./types";
import { logger, LogEvents } from "./logger";

/**
 * Get D1 database from platform context
 * Throws if database is not available
 */
export function getDB(platform: App.Platform | undefined): D1Database {
  if (!platform?.env?.DB) {
    throw new Error("D1 database not available in platform context");
  }
  return platform.env.DB;
}

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Find user by email
 */
export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM user WHERE email = ?")
    .bind(email)
    .first<User>();

  return result || null;
}

/**
 * Find user by ID
 */
export async function findUserById(
  db: D1Database,
  userId: string,
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM user WHERE id = ?")
    .bind(userId)
    .first<User>();

  return result || null;
}

// ============================================================================
// SCAN QUERIES (User-Scoped)
// ============================================================================

/**
 * Get all scans for a specific user
 *
 * @param db - D1 database instance
 * @param userId - User ID to scope the query
 * @param limit - Maximum number of scans to return (default: 50)
 * @returns Array of scans
 */
export async function getUserScans(
  db: D1Database,
  userId: string,
  limit: number = 50,
): Promise<Scan[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, isbn, title, json_data, status, created_at, updated_at
			 FROM scans 
			 WHERE user_id = ? 
			 ORDER BY created_at DESC 
			 LIMIT ?`,
    )
    .bind(userId, limit)
    .all<Scan>();

  logger.info("scan_history_fetched", {
    userId,
    count: result.results?.length || 0,
  });
  return result.results || [];
}

/**
 * Count total scans for a user
 */
export async function countUserScans(
  db: D1Database,
  userId: string,
): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as total FROM scans WHERE user_id = ?")
    .bind(userId)
    .first<{ total: number }>();

  return result?.total || 0;
}

/**
 * Get a specific scan by ID (with user ownership check)
 *
 * @param db - D1 database instance
 * @param scanId - Scan ID
 * @param userId - User ID to verify ownership
 * @returns Scan if found and owned by user, null otherwise
 */
export async function getScanById(
  db: D1Database,
  scanId: number,
  userId: string,
): Promise<Scan | null> {
  const result = await db
    .prepare("SELECT * FROM scans WHERE id = ? AND user_id = ?")
    .bind(scanId, userId)
    .first<Scan>();

  return result || null;
}

/**
 * Create or update a scan (user-scoped with UPSERT logic)
 *
 * This function implements UPSERT logic to prevent duplicate scans:
 * 1. First checks if a scan exists for this user+isbn
 * 2. If exists, updates it with new data
 * 3. If not exists, inserts new row
 *
 * @param db - D1 database instance
 * @param userId - User ID who owns this scan
 * @param isbn - Book ISBN
 * @param title - Book title
 * @param jsonData - Merged book metadata (serialized JSON)
 * @param status - Scan status (default: 'draft')
 * @returns Scan ID (existing or newly created)
 */
export async function createScan(
  db: D1Database,
  userId: string,
  isbn: string,
  title: string,
  jsonData: string,
  status: "draft" | "published" | "archived" = "draft",
): Promise<number> {
  try {
    // Check if scan already exists for this user+isbn
    const existing = await db
      .prepare(`SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1`)
      .bind(userId, isbn)
      .first<{ id: number }>();

    if (existing?.id) {
      // UPDATE existing scan
      await db
        .prepare(
          `UPDATE scans SET title = ?, json_data = ?, status = ?, updated_at = datetime('now')
           WHERE id = ? AND user_id = ?`,
        )
        .bind(title, jsonData, status, existing.id, userId)
        .run();

      logger.info(LogEvents.SCAN_CREATED, {
        userId,
        scanId: existing.id,
        isbn,
        action: "updated",
      });

      return existing.id;
    }

    // INSERT new scan
    const result = await db
      .prepare(
        `INSERT INTO scans (user_id, isbn, title, json_data, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(userId, isbn, title, jsonData, status)
      .run();

    if (!result.success) {
      throw new Error("Failed to create scan");
    }

    // Get the inserted ID
    const lastInserted = await db
      .prepare(`SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1`)
      .bind(userId, isbn)
      .first<{ id: number }>();

    if (lastInserted?.id) {
      logger.info(LogEvents.SCAN_CREATED, {
        userId,
        scanId: lastInserted.id,
        isbn,
        action: "inserted",
      });
      return lastInserted.id;
    }

    logger.error(LogEvents.DB_WRITE_FAILED, {
      userId,
      isbn,
      context: "createScan",
    });
    return 0;
  } catch (err) {
    // Handle race condition: UNIQUE constraint violation
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes("UNIQUE constraint failed") ||
      errorMsg.includes("SQLITE_CONSTRAINT")
    ) {
      // Another request won the race, fetch that row
      const fallback = await db
        .prepare(`SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1`)
        .bind(userId, isbn)
        .first<{ id: number }>();

      if (fallback?.id) {
        logger.info(LogEvents.SCAN_CREATED, {
          userId,
          scanId: fallback.id,
          isbn,
          action: "race_resolved",
        });
        return fallback.id;
      }
    }
    throw err;
  }
}

/**
 * Create a new ANONYMOUS scan (no user_id)
 *
 * @param db - D1 database instance
 * @param isbn - Book ISBN
 * @param title - Book title
 * @param jsonData - Merged book metadata (serialized JSON)
 * @param status - Scan status (default: 'draft')
 * @returns Inserted scan ID
 */
export async function createAnonymousScan(
  db: D1Database,
  isbn: string,
  title: string,
  jsonData: string,
  status: "draft" | "published" | "archived" = "draft",
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO scans (user_id, isbn, title, json_data, status, created_at, updated_at)
			 VALUES (NULL, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(isbn, title, jsonData, status)
    .run();

  if (!result.success) {
    throw new Error("Failed to create anonymous scan");
  }

  // Since we can't reliably get the last inserted ID for an anonymous
  // scan without a user_id, we'll return 0 as a placeholder.
  // This is acceptable as anonymous scans are for logging/analytics
  // and don't need to be retrieved individually.
  return 0;
}

/**
 * Update scan status
 */
export async function updateScanStatus(
  db: D1Database,
  scanId: number,
  userId: string,
  status: "draft" | "published" | "archived",
): Promise<void> {
  await db
    .prepare(
      `UPDATE scans 
			 SET status = ?, updated_at = datetime('now') 
			 WHERE id = ? AND user_id = ?`,
    )
    .bind(status, scanId, userId)
    .run();
}

/**
 * Delete a scan (with user ownership check)
 */
export async function deleteScan(
  db: D1Database,
  scanId: number,
  userId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM scans WHERE id = ? AND user_id = ?")
    .bind(scanId, userId)
    .run();
}

/**
 * Get recent scans across all users (admin only)
 * USE WITH CAUTION: This bypasses user scoping
 */
export async function getRecentScansGlobal(
  db: D1Database,
  limit: number = 20,
): Promise<Scan[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, isbn, title, status, created_at
			 FROM scans 
			 ORDER BY created_at DESC 
			 LIMIT ?`,
    )
    .bind(limit)
    .all<Scan>();

  return result.results || [];
}

// ============================================================================
// ANALYTICS / STATS QUERIES
// ============================================================================

/**
 * Get user statistics
 */
export async function getUserStats(db: D1Database, userId: string) {
  const [total, published, draft] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) as count FROM scans WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND status = 'published'",
      )
      .bind(userId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND status = 'draft'",
      )
      .bind(userId)
      .first<{ count: number }>(),
  ]);

  return {
    totalScans: total?.count || 0,
    publishedScans: published?.count || 0,
    draftScans: draft?.count || 0,
  };
}
