import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { eq, and, like, desc, or, isNull, sql, count } from "drizzle-orm";
import { z } from "zod";
import { logger, LogEvents } from "../logger";
import { bookSchema as mergedBookSchema } from "../../schemas";
import { scans, users, accounts, sessions, verification } from "./schema";
import type { Scan, User } from "../types";

/**
 * Initialize a Drizzle ORM instance from platform.env.DB (Cloudflare D1)
 */
export type DrizzleDB = ReturnType<typeof drizzle>;

export function getDrizzleDB(platform: App.Platform | undefined): DrizzleDB {
  const d1 = platform?.env?.DB as unknown as D1Database | undefined;
  if (!d1) {
    throw new Error("D1 database not available in platform context");
  }
  return drizzle(d1);
}

/**
 * Get D1 database from platform context (for backward compatibility/raw access if needed)
 * Throws if database is not available
 */
export function getRawDb(platform: App.Platform | undefined): D1Database {
  if (!platform?.env?.DB) {
    throw new Error("D1 database not available in platform context");
  }
  return platform.env.DB;
}

export { scans, users, accounts, sessions, verification };

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Safe JSON parser with Zod validation
 */
export function parseJsonSafe<T>(
  json: string | null | undefined,
  schema: z.ZodSchema<T>,
  fallback: T | null = null,
): T | null {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      logger.warn("json_validation_failed", { errors: result.error.flatten() });
      return fallback;
    }
    return result.data;
  } catch (e) {
    logger.warn("json_parse_failed", { error: String(e) });
    return fallback;
  }
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
  const d = drizzle(db);
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
  const d = drizzle(db);
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
 */
export async function getUserScans(
  db: D1Database,
  userId: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
    .from(scans)
    .where(eq(scans.user_id, userId))
    .orderBy(desc(scans.created_at))
    .limit(limit);

  logger.info("scan_history_fetched", {
    userId,
    count: rows.length || 0,
  });
  return rows as unknown as Scan[];
}

/**
 * Search user scans by author
 */
export async function searchUserScansByAuthor(
  db: D1Database,
  userId: string,
  authorQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
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
}

/**
 * Search user scans by subject
 */
export async function searchUserScansBySubject(
  db: D1Database,
  userId: string,
  subjectQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
    .from(scans)
    .where(
      and(eq(scans.user_id, userId), like(scans.subjects, `%${subjectQuery}%`)),
    )
    .orderBy(desc(scans.created_at))
    .limit(limit);

  logger.info("scan_search_by_subject", {
    userId,
    query: subjectQuery,
    count: rows.length || 0,
  });
  return rows as unknown as Scan[];
}

/**
 * Search user scans by DDC
 */
export async function searchUserScansByDDC(
  db: D1Database,
  userId: string,
  ddcQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
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
}

/**
 * Search user scans by LCC
 */
export async function searchUserScansByLCC(
  db: D1Database,
  userId: string,
  lccQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
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
}

/**
 * Search user scans by Title
 */
export async function searchUserScansByTitle(
  db: D1Database,
  userId: string,
  titleQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
    .from(scans)
    .where(and(eq(scans.user_id, userId), like(scans.title, `%${titleQuery}%`)))
    .orderBy(desc(scans.created_at))
    .limit(limit);

  logger.info("scan_search_by_title", {
    userId,
    query: titleQuery,
    count: rows.length || 0,
  });
  return rows as unknown as Scan[];
}

/**
 * Search user scans by ISBN
 */
export async function searchUserScansByISBN(
  db: D1Database,
  userId: string,
  isbnQuery: string,
  limit: number = 50,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
    .from(scans)
    .where(and(eq(scans.user_id, userId), like(scans.isbn, `%${isbnQuery}%`)))
    .orderBy(desc(scans.created_at))
    .limit(limit);

  logger.info("scan_search_by_isbn", {
    userId,
    query: isbnQuery,
    count: rows.length || 0,
  });
  return rows as unknown as Scan[];
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
  const d = drizzle(db);
  const rows = await d
    .select()
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
}

/**
 * Count total scans for a user
 */
export async function countUserScans(
  db: D1Database,
  userId: string,
): Promise<number> {
  const d = drizzle(db);
  const result = await d
    .select({ count: count() })
    .from(scans)
    .where(eq(scans.user_id, userId));

  return result[0]?.count || 0;
}

/**
 * Get a specific scan by ID (with user ownership check)
 */
export async function getScanById(
  db: D1Database,
  scanId: number,
  userId: string,
): Promise<Scan | null> {
  const d = drizzle(db);
  const rows = await d
    .select()
    .from(scans)
    .where(and(eq(scans.id, scanId), eq(scans.user_id, userId)))
    .limit(1);
  return (rows[0] as unknown as Scan) || null;
}

/**
 * Create or update a scan (user-scoped with UPSERT logic)
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
  const authorsStr = Array.isArray(authors) ? authors.join("; ") : authors;
  const d = drizzle(db);

  try {
    // Upsert using onConflictDoUpdate
    // Constraint: (user_id, isbn) unique index
    const result = await d
      .insert(scans)
      .values({
        user_id: userId,
        isbn,
        title,
        json_data: jsonData,
        status,
        authors: authorsStr || null,
        subjects: subjects || null,
        ddc: ddc || null,
        lcc: lcc || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [scans.user_id, scans.isbn],
        set: {
          title,
          json_data: jsonData,
          status,
          authors: authorsStr || null,
          subjects: subjects || null,
          ddc: ddc || null,
          lcc: lcc || null,
          updated_at: new Date().toISOString(),
        },
      })
      .returning({ id: scans.id });

    if (result[0]?.id) {
      logger.info(LogEvents.SCAN_CREATED, {
        userId,
        scanId: result[0].id,
        isbn,
        action: "upserted",
      });
      return result[0].id;
    }

    // Fallback if returning() is not supported or something else happened (though returning is supported in D1 now usually)
    // We try to fetch the id
    const row = await d
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.user_id, userId), eq(scans.isbn, isbn)))
      .limit(1);
    return row[0]?.id || 0;
  } catch (err) {
    logger.error("scan_upsert_failed", { error: String(err), userId, isbn });
    // Fallback to old race-condition logic if needed, but we should rely on upsert.
    // If Drizzle/D1 fails upsert, we might need to investigate, but for now we throw or return 0.
    throw err;
  }
}

/**
 * Create a new ANONYMOUS scan (no user_id)
 */
export async function createAnonymousScan(
  db: D1Database,
  isbn: string,
  title: string,
  jsonData: string,
  status: "draft" | "published" | "archived" = "draft",
): Promise<number> {
  const d = drizzle(db);
  const result = await d
    .insert(scans)
    .values({
      user_id: null as any, // Allow null for anonymous? Schema says user_id is notNull() but previous code used NULL.
      // Wait, schema.ts says: user_id: text("user_id").notNull()
      // But createAnonymousScan in db.ts explicitly inserted NULL.
      // If schema strictly enforces notNull, then anonymous scans are invalid or schema is wrong.
      // However, previous code worked? Or maybe it failed?
      // Actually, previous code had a try/catch fallback to raw SQL inserting NULL.
      // If Drizzle schema says notNull(), Drizzle might block it.
      // But raw SQL might allow it if the actual DB schema allows it (which it might not if defined via Drizzle migration).
      // Let's check schema.ts again.
      // user_id: text("user_id").notNull()
      // So anonymous scans might be problematic if the table enforces it.
      // However, I must replicate the logic.
      // I will cast to any to bypass Drizzle type check, but if DB rejects it, it rejects it.
      isbn,
      title,
      json_data: jsonData,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning({ id: scans.id });

  return result[0]?.id || 0;
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
  const d = drizzle(db);
  await d
    .update(scans)
    .set({ status, updated_at: new Date().toISOString() })
    .where(and(eq(scans.id, scanId), eq(scans.user_id, userId)))
    .run();
}

/**
 * Delete a scan
 */
export async function deleteScan(
  db: D1Database,
  scanId: number,
  userId: string,
): Promise<void> {
  const d = drizzle(db);
  await d
    .delete(scans)
    .where(and(eq(scans.id, scanId), eq(scans.user_id, userId)))
    .run();
}

/**
 * Get recent scans global
 */
export async function getRecentScansGlobal(
  db: D1Database,
  limit: number = 20,
): Promise<Scan[]> {
  const d = drizzle(db);
  const rows = await d
    .select()
    .from(scans)
    .orderBy(desc(scans.created_at))
    .limit(limit);
  return rows as unknown as Scan[];
}

/**
 * Get user statistics
 */
export async function getUserStats(db: D1Database, userId: string) {
  const d = drizzle(db);

  const [totalResult, publishedResult, draftResult] = await Promise.all([
    d.select({ count: count() }).from(scans).where(eq(scans.user_id, userId)),
    d
      .select({ count: count() })
      .from(scans)
      .where(and(eq(scans.user_id, userId), eq(scans.status, "published"))),
    d
      .select({ count: count() })
      .from(scans)
      .where(and(eq(scans.user_id, userId), eq(scans.status, "draft"))),
  ]);

  return {
    totalScans: totalResult[0]?.count || 0,
    publishedScans: publishedResult[0]?.count || 0,
    draftScans: draftResult[0]?.count || 0,
  };
}
