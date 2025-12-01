/**
 * Database (D1) operations layer
 *
 * Single source of truth for D1 database queries.
 * Provides typed, reusable query helpers for all D1 operations.
 */

import type { D1Database, Scan, User } from "./types";
import { logger, LogEvents } from "./logger";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, like, desc, or, isNull } from "drizzle-orm";
import { scans, users } from "./db/schema";

/**
 * Get D1 database from platform context
 * Throws if database is not available
 */
export function getRawDb(platform: App.Platform | undefined): D1Database {
  if (!platform?.env?.DB) {
    throw new Error("D1 database not available in platform context");
  }
  return platform.env.DB;
}

// Backwards compatible alias
// NOTE: `getRawDb` is the canonical accessor for the D1 database.
// The old `getDB` alias has been removed to encourage explicit naming.

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
  const d = drizzle(db as any);
  const rows = await d
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return (rows[0] as unknown as User) || null;
}

/**
 * Find user by ID
 */
export async function findUserById(
  db: D1Database,
  userId: string,
): Promise<User | null> {
  const d = drizzle(db as any);
  const rows = await d
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (rows[0] as unknown as User) || null;
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
  const d = drizzle(db as any);
  const rows = await d
    .select({
      id: scans.id,
      user_id: scans.user_id,
      isbn: scans.isbn,
      title: scans.title,
      json_data: scans.json_data,
      status: scans.status,
      created_at: scans.created_at,
      updated_at: scans.updated_at,
    })
    .from(scans)
    .where(eq(scans.user_id, userId))
    .orderBy(desc(scans.created_at))
    .limit(limit);
  logger.info("scan_history_fetched", {
    userId,
    count: rows.length || 0,
  });
  return rows as unknown as Scan[];
  logger.info("scan_history_fetched", {
    userId,
    count: rows.length || 0,
  });
  return rows as unknown as Scan[];
}

/**
 * Search user scans by author (partial match, case-insensitive)
 */
export async function searchUserScansByAuthor(
  db: D1Database,
  userId: string,
  authorQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  try {
    const d = drizzle(db as any);
    const rows = await d
      .select({
        id: scans.id,
        user_id: scans.user_id,
        isbn: scans.isbn,
        title: scans.title,
        authors: scans.authors,
        subjects: scans.subjects,
        ddc: scans.ddc,
        lcc: scans.lcc,
        json_data: scans.json_data,
        status: scans.status,
        created_at: scans.created_at,
        updated_at: scans.updated_at,
      })
      .from(scans)
      .where(
        and(eq(scans.user_id, userId), like(scans.authors, `%${authorQuery}%`)),
      )
      .orderBy(desc(scans.created_at))
      .limit(limit);

    logger.info("scan_search_by_author", {
      userId,
      query: authorQuery,
      count: rows.length || 0,
    });
    return rows as unknown as Scan[];
  } catch (e) {
    const result = await db
      .prepare(
        `SELECT id, user_id, isbn, title, authors, subjects, ddc, lcc, json_data, status, created_at, updated_at
         FROM scans
         WHERE user_id = ? AND authors LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(userId, `%${authorQuery}%`, limit)
      .all<Scan>();

    logger.info("scan_search_by_author", {
      userId,
      query: authorQuery,
      count: result.results?.length || 0,
    });
    return result.results || [];
  }
}

/**
 * Search user scans by subject (partial match, case-insensitive)
 */
export async function searchUserScansBySubject(
  db: D1Database,
  userId: string,
  subjectQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  try {
    const d = drizzle(db as any);
    const rows = await d
      .select({
        id: scans.id,
        user_id: scans.user_id,
        isbn: scans.isbn,
        title: scans.title,
        authors: scans.authors,
        subjects: scans.subjects,
        ddc: scans.ddc,
        lcc: scans.lcc,
        json_data: scans.json_data,
        status: scans.status,
        created_at: scans.created_at,
        updated_at: scans.updated_at,
      })
      .from(scans)
      .where(
        and(
          eq(scans.user_id, userId),
          like(scans.subjects, `%${subjectQuery}%`),
        ),
      )
      .orderBy(desc(scans.created_at))
      .limit(limit);

    logger.info("scan_search_by_subject", {
      userId,
      query: subjectQuery,
      count: rows.length || 0,
    });
    return rows as unknown as Scan[];
  } catch (e) {
    const result = await db
      .prepare(
        `SELECT id, user_id, isbn, title, authors, subjects, ddc, lcc, json_data, status, created_at, updated_at
         FROM scans
         WHERE user_id = ? AND subjects LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(userId, `%${subjectQuery}%`, limit)
      .all<Scan>();

    logger.info("scan_search_by_subject", {
      userId,
      query: subjectQuery,
      count: result.results?.length || 0,
    });
    return result.results || [];
  }
}

/**
 * Search user scans by DDC classification (exact or prefix match)
 */
export async function searchUserScansByDDC(
  db: D1Database,
  userId: string,
  ddcQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  try {
    const d = drizzle(db as any);
    const rows = await d
      .select({
        id: scans.id,
        user_id: scans.user_id,
        isbn: scans.isbn,
        title: scans.title,
        authors: scans.authors,
        subjects: scans.subjects,
        ddc: scans.ddc,
        lcc: scans.lcc,
        json_data: scans.json_data,
        status: scans.status,
        created_at: scans.created_at,
        updated_at: scans.updated_at,
      })
      .from(scans)
      .where(and(eq(scans.user_id, userId), like(scans.ddc, `${ddcQuery}%`)))
      .orderBy(desc(scans.created_at))
      .limit(limit);

    logger.info("scan_search_by_ddc", {
      userId,
      query: ddcQuery,
      count: rows.length || 0,
    });
    return rows as unknown as Scan[];
  } catch (e) {
    const result = await db
      .prepare(
        `SELECT id, user_id, isbn, title, authors, subjects, ddc, lcc, json_data, status, created_at, updated_at
         FROM scans
         WHERE user_id = ? AND ddc LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(userId, `${ddcQuery}%`, limit)
      .all<Scan>();

    logger.info("scan_search_by_ddc", {
      userId,
      query: ddcQuery,
      count: result.results?.length || 0,
    });
    return result.results || [];
  }
}

/**
 * Search user scans by LCC classification (exact or prefix match)
 */
export async function searchUserScansByLCC(
  db: D1Database,
  userId: string,
  lccQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  try {
    const d = drizzle(db as any);
    const rows = await d
      .select({
        id: scans.id,
        user_id: scans.user_id,
        isbn: scans.isbn,
        title: scans.title,
        authors: scans.authors,
        subjects: scans.subjects,
        ddc: scans.ddc,
        lcc: scans.lcc,
        json_data: scans.json_data,
        status: scans.status,
        created_at: scans.created_at,
        updated_at: scans.updated_at,
      })
      .from(scans)
      .where(and(eq(scans.user_id, userId), like(scans.lcc, `${lccQuery}%`)))
      .orderBy(desc(scans.created_at))
      .limit(limit);

    logger.info("scan_search_by_lcc", {
      userId,
      query: lccQuery,
      count: rows.length || 0,
    });
    return rows as unknown as Scan[];
  } catch (e) {
    const result = await db
      .prepare(
        `SELECT id, user_id, isbn, title, authors, subjects, ddc, lcc, json_data, status, created_at, updated_at
         FROM scans
         WHERE user_id = ? AND lcc LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(userId, `${lccQuery}%`, limit)
      .all<Scan>();

    logger.info("scan_search_by_lcc", {
      userId,
      query: lccQuery,
      count: result.results?.length || 0,
    });
    return result.results || [];
  }
}

/**
 * General search across title, authors, subjects, and ISBN
 */
export async function searchUserScansGeneral(
  db: D1Database,
  userId: string,
  query: string,
  limit: number = 50,
): Promise<Scan[]> {
  const searchTerm = `%${query}%`;
  try {
    const d = drizzle(db as any);
    const rows = await d
      .select({
        id: scans.id,
        user_id: scans.user_id,
        isbn: scans.isbn,
        title: scans.title,
        authors: scans.authors,
        subjects: scans.subjects,
        ddc: scans.ddc,
        lcc: scans.lcc,
        json_data: scans.json_data,
        status: scans.status,
        created_at: scans.created_at,
        updated_at: scans.updated_at,
      })
      .from(scans)
      .where(
        and(
          eq(scans.user_id, userId),
          or(
            like(scans.title, searchTerm),
            like(scans.authors, searchTerm),
            like(scans.subjects, searchTerm),
            like(scans.isbn, searchTerm),
          ),
        ),
      )
      .orderBy(desc(scans.created_at))
      .limit(limit);

    logger.info("scan_search_general", {
      userId,
      query,
      count: rows.length || 0,
    });
    return rows as unknown as Scan[];
  } catch (e) {
    const result = await db
      .prepare(
        `SELECT id, user_id, isbn, title, authors, subjects, ddc, lcc, json_data, status, created_at, updated_at
         FROM scans
         WHERE user_id = ? AND (
           title LIKE ? OR
           authors LIKE ? OR
           subjects LIKE ? OR
           isbn LIKE ?
         )
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(userId, searchTerm, searchTerm, searchTerm, searchTerm, limit)
      .all<Scan>();

    logger.info("scan_search_general", {
      userId,
      query,
      count: result.results?.length || 0,
    });
    return result.results || [];
  }
}

/**
 * Count total scans for a user
 */
export async function countUserScans(
  db: D1Database,
  userId: string,
): Promise<number> {
  try {
    const d = drizzle(db as any);
    const rows = await d.select().from(scans).where(eq(scans.user_id, userId));
    // Use .length as a quick count fallback (not ideal for performance on large datasets)
    return rows.length || 0;
  } catch (e) {
    const result = await db
      .prepare("SELECT COUNT(*) as total FROM scans WHERE user_id = ?")
      .bind(userId)
      .first<{ total: number }>();

    return result?.total || 0;
  }
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
  const d = drizzle(db as any);
  const rows = await d
    .select()
    .from(scans)
    .where(and(eq(scans.id, scanId), eq(scans.user_id, userId)))
    .limit(1);
  return (rows[0] as unknown as Scan) || null;
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
  authors?: string[] | string,
  subjects?: string,
  ddc?: string,
  lcc?: string,
): Promise<number> {
  // Normalize authors to string if array
  const authorsStr = Array.isArray(authors) ? authors.join("; ") : authors;
  try {
    const d = drizzle(db as any);

    if (userId) {
      const existing = await d
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.user_id, userId), eq(scans.isbn, isbn)))
        .limit(1);
      if (existing[0]?.id) {
        await d
          .update(scans)
          .set({
            title,
            json_data: jsonData,
            status,
            authors: authorsStr || null,
            subjects: subjects || null,
            ddc: ddc || null,
            lcc: lcc || null,
            updated_at: new Date().toISOString(),
          })
          .where(eq(scans.id, existing[0].id))
          .run();

        logger.info(LogEvents.SCAN_CREATED, {
          userId,
          scanId: existing[0].id,
          isbn,
          action: "updated",
        });
        return existing[0].id;
      }
    }

    await d
      .insert(scans)
      .values({
        user_id: userId as any,
        isbn,
        title,
        json_data: jsonData,
        status,
        authors: (authorsStr || null) as any,
        subjects: subjects || null,
        ddc: ddc || null,
        lcc: lcc || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .run();

    if (userId) {
      const inserted = await d
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.user_id, userId), eq(scans.isbn, isbn)))
        .limit(1);
      if (inserted[0]?.id) {
        logger.info(LogEvents.SCAN_CREATED, {
          userId,
          scanId: inserted[0].id,
          isbn,
          action: "inserted",
        });
        return inserted[0].id;
      }
    }
    return 0;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes("UNIQUE constraint failed") ||
      errorMsg.includes("SQLITE_CONSTRAINT")
    ) {
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
  try {
    const d = drizzle(db as any);
    await d
      .insert(scans)
      .values({
        user_id: null as any,
        isbn,
        title,
        json_data: jsonData,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .run();

    // Attempt to find inserted row
    const inserted = await d
      .select({ id: scans.id })
      .from(scans)
      .where(and(isNull(scans.user_id), eq(scans.isbn, isbn)))
      .limit(1);
    if (inserted[0]?.id) return inserted[0].id;
    return 0;
  } catch (e) {
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
    return 0;
  }
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
  const d = drizzle(db as any);
  await d
    .update(scans)
    .set({ status, updated_at: new Date().toISOString() })
    .where(and(eq(scans.id, scanId), eq(scans.user_id, userId)))
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
  const d = drizzle(db as any);
  await d
    .delete(scans)
    .where(and(eq(scans.id, scanId), eq(scans.user_id, userId)))
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
  const d = drizzle(db as any);
  const rows = await d
    .select({
      id: scans.id,
      user_id: scans.user_id,
      isbn: scans.isbn,
      title: scans.title,
      status: scans.status,
      created_at: scans.created_at,
    })
    .from(scans)
    .orderBy(desc(scans.created_at))
    .limit(limit);
  return rows as unknown as Scan[];
}

// ============================================================================
// ANALYTICS / STATS QUERIES
// ============================================================================

/**
 * Get user statistics
 */
export async function getUserStats(db: D1Database, userId: string) {
  // Use raw D1 queries for counts to avoid Drizzle aggregate typing complexities
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
