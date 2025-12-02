import type { DrizzleDB } from "./index";
import { scans } from "./schema";
import { eq, and } from "drizzle-orm";
import { logger, LogEvents } from "$lib/server/logger";

export async function findAnyScanByIsbn(db: DrizzleDB, isbn: string) {
  const rows = await db
    .select({ id: scans.id, json_data: scans.json_data })
    .from(scans)
    .where(eq(scans.isbn, isbn))
    .limit(1);
  return rows[0] ?? null;
}

export async function createScanDrizzle(
  db: DrizzleDB,
  userId: string | null,
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
  try {
    if (userId) {
      // Check existing scan for this user+isbn
      const existing = await db
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.user_id, userId as string), eq(scans.isbn, isbn)))
        .limit(1);

      if (existing[0]?.id) {
        await db
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

    // Insert new
    if (userId) {
      await db
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
        .run();
    } else {
      // Anonymous scan, do not insert
      return 0;
    }

    // Query inserted record to get id
    if (userId) {
      const inserted = await db
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.user_id, userId as string), eq(scans.isbn, isbn)))
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

    // For anonymous or fallback, return 0
    return 0;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes("UNIQUE constraint failed") ||
      errorMsg.includes("SQLITE_CONSTRAINT")
    ) {
      // Race condition: fetch existing
      const fallback = await db
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.user_id, userId as string), eq(scans.isbn, isbn)))
        .limit(1);
      if (fallback[0]?.id) {
        logger.info(LogEvents.SCAN_CREATED, {
          userId,
          scanId: fallback[0].id,
          isbn,
          action: "race_resolved",
        });
        return fallback[0].id;
      }
    }
    throw err;
  }
}

export default {
  findAnyScanByIsbn,
  createScanDrizzle,
};
