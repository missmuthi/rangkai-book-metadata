import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { generateObject, generateText } from "ai";
import { logger } from "$lib/server/logger";
import { Analytics } from "$lib/services/analytics";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { deepClean, normalizeKeys } from "$lib/utils/metadata";
import type { MergedBookData } from "$lib/types";

// Define the Schema STRICTLY
const metadataSchema = z.object({
  title: z.string(),
  publisher: z.string().describe("Format: Place : Publisher, Year"),
  authors: z
    .array(z.string())
    .describe("List of authors without titles like Ph.D"),
  description: z.string().describe("Concise 2-sentence summary"),

  // The Critical Fields
  ddc: z
    .string()
    .describe("Dewey Decimal Code. ESTIMATE if unknown. Ex: 005.1"),
  lcc: z
    .string()
    .describe("Library of Congress Code. ESTIMATE if unknown. Ex: QA76"),
  language: z.string().describe("ISO 639-2 code (e.g. eng, ind)"),
  subjects: z.string().describe("Semicolon separated subject headings"),
  series: z.string().optional(),
  edition: z.string().optional(),
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AI Clean Endpoint with Write-Through Persistence
 *
 * This endpoint:
 * 1. Cleans book metadata using AI with aggressive completion
 * 2. Deep merges data to prevent loss
 * 3. Auto-saves to D1 database with audit log
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  // Enhanced authentication check with detailed error logging
  logger.debug("ai_clean_auth_check_started", { sessionExists: !!locals.session, userExists: !!locals.user, platformExists: !!platform, envExists: !!platform?.env, dbExists: !!platform?.env?.DB });

  if (!locals.session || !locals.user) {
    logger.warn("ai_clean_auth_failed", { reason: "no_session_or_user" });
    return json(
      {
        error: "Authentication required. Please log in again.",
        code: "NO_SESSION",
      },
      { status: 401 },
    );
  }

  const userId = locals.user.id;
  const DB = platform?.env?.DB;

  logger.info("ai_clean_auth_success", { userId });

  try {
    const body = (await request.json()) as MergedBookData & {
      scan_id?: number;
      mode?: string;
    };
    const { scan_id, mode: _mode = "fill_gaps", ...book } = body;

    if (!book) {
      logger.warn("ai_clean_no_book_provided", {});
      return json({ error: "No book data provided" }, { status: 400 });
    }

    if (!DB) {
      logger.error("ai_clean_no_database", {});
      return json(
        {
          error:
            "Database unavailable. This may be a deployment configuration issue.",
          code: "NO_DATABASE",
        },
        { status: 500 },
      );
    }

    const apiKey = platform.env.GROQ_API_KEY;
    if (!apiKey) {
      logger.error("ai_clean_missing_api_key", {});
      return json(
        {
          error:
            "AI service is not configured (missing GROQ_API_KEY).",
          code: "AI_NOT_CONFIGURED",
        },
        { status: 500 },
      );
    }

    const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });

    logger.debug("ai_clean_request_validated", { title: book.title || 'Untitled', isbn: book.isbn || 'N/A' });

    // 1. SLIMS SENIOR LIBRARIAN SYSTEM PROMPT (Optimized for Indonesian libraries)
    const systemPrompt = `You are a **Senior Librarian & SLiMS Cataloging Expert** with 20+ years of experience in Indonesian academic libraries.

Your mission: Transform raw book metadata into **SLiMS-ready bibliographic records** that comply with international cataloging standards (AACR2, RDA, MARC21).

## CRITICAL CATALOGING RULES:

### 1. Classification Codes (MANDATORY - NEVER leave empty)
  - Examples: "005.133" (Java programming), "610.73" (Nursing), "330" (Economics)
  - ESTIMATE from title/subjects if not provided
  - Examples: "QA76.73.J38" (Java), "RT41" (Nursing), "HB171" (Economics)
  - ESTIMATE from title/subjects if not provided

### 2. Publisher Format (ISBD Standard)
Format: "Place : Publisher, Year"

### 3. Author Names

### 4. Language Codes (ISO 639-2)

### 5. Subject Headings

### 6. Description

## INPUT DATA:
${JSON.stringify(book, null, 2)}

## YOUR TASK:
Complete ALL fields with accurate, SLiMS-compatible values. Every empty or missing field must be filled with your best professional estimate.`;

    // 2. GENERATE DATA (defensive: handle failures in production)
    let rawAiResult: unknown = null;
    let usedCache = false;

    // CHECK CACHE FIRST
    const isbn = book.isbn13 || book.isbn10 || book.isbn;
    const cacheKey = isbn ? `book-clean:${isbn}` : null;

    if (cacheKey && platform?.env?.BOOK_CACHE) {
      try {
        const cached = await platform.env.BOOK_CACHE.get(cacheKey, "json");
        if (cached) {
          logger.info("ai_clean_cache_hit", { isbn });
          rawAiResult = cached;
          usedCache = true;
        }
      } catch (cacheErr) {
        logger.warn("ai_clean_cache_read_failed", { error: cacheErr });
      }
    }

    if (!usedCache) {
      try {
        logger.debug("ai_clean_groq_call_started", {});
        const startTime = Date.now();

        let attempt = 0;
        let gen;
        let lastError: unknown = null;

        // RETRY LOGIC for 429 Errors
        while (attempt < 3) {
          try {
            gen = await generateObject({
              model: groq("llama-3.3-70b-versatile"),
              schema: metadataSchema,
              system: systemPrompt,
              prompt: `Complete the bibliographic record for: "${book.title || "Unknown Title"}" by ${book.author || "Unknown Author"}. ISBN: ${book.isbn13 || book.isbn10 || book.isbn || "N/A"}`,
            });
            break; // Success
          } catch (e: any) {
            attempt++;
            lastError = e;
            const errorMessage = e instanceof Error ? e.message : String(e);
            const isRateLimit = errorMessage.includes("quota") || errorMessage.includes("429");

            if (isRateLimit && attempt < 3) {
              const waitTime = 2000 * Math.pow(2, attempt - 1); // 2s, 4s
              logger.warn("ai_clean_rate_limit_retry", { attempt, waitTime });
              await delay(waitTime);
              continue;
            }
            // For json_schema unsupported, break to fallback logic
            if (String(errorMessage).includes('json_schema')) {
              break;
            }
            throw e; // Non-retriable or retries exhausted
          }
        }

        rawAiResult = gen?.object ?? null;

        // If generation failed due to unsupported `json_schema` format, attempt text fallback
        if (!rawAiResult && lastError && String(lastError).includes('json_schema')) {
          try {
            logger.info('ai_clean_groq_fallback_to_generateText_loop', {});
            const fallbackPromptLoop = `${systemPrompt}\n\nReturn ONLY a single valid JSON object matching the expected metadata schema.`;
            const textResultLoop = await generateText({ model: groq("llama-3.3-70b-versatile"), prompt: fallbackPromptLoop });
            const outputTextLoop = (textResultLoop as any).output_text || (textResultLoop as any).output?.[0]?.content?.find((c: any) => c.type === 'output_text')?.text || (textResultLoop as any).output?.[0]?.content?.[0]?.text;
            if (typeof outputTextLoop === 'string') {
              rawAiResult = JSON.parse(outputTextLoop);
              try {
                Analytics.track('ai_fallback_used', { model: 'llama-3.3-70b-versatile', provider: 'groq', isbn: isbn || undefined, reason: 'json_schema_unsupported' });
              } catch (analyticsErr) {
                logger.debug('analytics_track_failed', { analyticsErr });
              }
            }
          } catch (fallbackLoopErr) {
            logger.error('ai_clean_generateText_fallback_failed_loop', { fallbackLoopErr });
          }
        }

        // WRITE TO CACHE (Aggressive: 7 days)
        if (rawAiResult && cacheKey && platform?.env?.BOOK_CACHE) {
          platform.context.waitUntil(
            platform.env.BOOK_CACHE.put(cacheKey, JSON.stringify(rawAiResult), {
              expirationTtl: 60 * 60 * 24 * 7, // 7 days
            })
          );
        }

        const duration = Date.now() - startTime;
        logger.info("ai_clean_groq_success", { duration });
      } catch (aiError) {
        const errorMessage =
          aiError instanceof Error ? aiError.message : String(aiError);
        logger.debug('ai_clean_groq_failed_message', { errorMessage });
        logger.error("ai_clean_groq_failed", { errorMessage });

        // Fallback for models that don't support json_schema: try a plain text JSON output and parse
        if (errorMessage.includes("json_schema")) {
          try {
            logger.info('ai_clean_groq_fallback_to_generateText', {});
            logger.debug('ai_clean_fallback_invoking_generateText_start', {});
            const fallbackPrompt = `${systemPrompt}\n\nReturn ONLY a single valid JSON object matching the expected metadata schema.`;
            const textResult = await generateText({ model: groq("llama-3.3-70b-versatile"), prompt: fallbackPrompt });
            logger.debug('ai_clean_fallback_invoking_generateText_end', {});
            const outputText = (textResult as any).output_text || (textResult as any).output?.[0]?.content?.find((c: any) => c.type === 'output_text')?.text || (textResult as any).output?.[0]?.content?.[0]?.text;
            if (typeof outputText === 'string') {
              try {
                rawAiResult = JSON.parse(outputText);
                logger.debug('ai_clean_fallback_raw', { rawAiResult });
                // if parsed, cache it
                if (rawAiResult && cacheKey && platform?.env?.BOOK_CACHE) {
                  platform.context.waitUntil(
                    platform.env.BOOK_CACHE.put(cacheKey, JSON.stringify(rawAiResult), {
                      expirationTtl: 60 * 60 * 24 * 7,
                    })
                  );
                }
              } catch (parseErr) {
                logger.warn('ai_clean_generateText_parse_failed', { parseErr });
              }
              try {
                Analytics.track('ai_fallback_used', { model: 'llama-3.3-70b-versatile', provider: 'groq', isbn: isbn || undefined, reason: 'json_schema_unsupported' });
              } catch (analyticsErr) {
                logger.debug('analytics_track_failed', { analyticsErr });
              }
            }
          } catch (fallbackErr) {
            logger.error('ai_clean_generateText_fallback_failed', { fallbackErr });
          }
        }

        // Check for common issues
        let userMessage = "AI metadata service is currently unavailable.";
        let errorCode = "AI_SERVICE_UNAVAILABLE";

          if (
          errorMessage.includes("API key") ||
          errorMessage.includes("authentication") ||
          errorMessage.includes("401")
        ) {
          userMessage =
            "AI service not configured. Please contact the administrator to set up GROQ_API_KEY.";
          errorCode = "AI_NOT_CONFIGURED";
          logger.warn("ai_clean_fix_suggestion", { suggestion: 'Add GROQ_API_KEY to Cloudflare Pages env' });
        } else if (
          errorMessage.includes("quota") ||
          errorMessage.includes("429")
        ) {
          userMessage = "System busy (Free Tier limit). Please wait 30 seconds and try again.";
          errorCode = "AI_QUOTA_EXCEEDED";
        } else if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("ECONNREFUSED")
        ) {
          userMessage = "AI service timed out. Please try again.";
          errorCode = "AI_TIMEOUT";
        }

        return json(
          {
            error: userMessage,
            code: errorCode,
            message: userMessage,
            debug:
              process.env.NODE_ENV === "development" ? errorMessage : undefined,
          },
          { status: 503 },
        );
      }
    }

    // 3. NORMALIZE & OPTIMIZE
    if (!rawAiResult) {
      logger.warn('ai_clean_no_ai_result', {});
    }
    logger.debug('ai_clean_raw_result', { rawAiResult });
    const aiResult = normalizeKeys(
      (rawAiResult ?? {}) as import("$lib/utils/metadata").AIResultInput,
    );
    const cleanAiResult = deepClean(aiResult) ?? {};
    logger.debug('ai_clean_normalized', { aiResult, cleanAiResult });

    // 4. DEEP MERGE (The Fix for Data Loss)
    // Parse existing JSON from book data (may be in json_data field or scattered in book object)
    const bookWithJson = book as MergedBookData & {
      json_data?: string | object;
    };
    let existingJson: Record<string, unknown> = {};
    if (bookWithJson.json_data) {
      try {
        existingJson =
          typeof bookWithJson.json_data === "string"
            ? JSON.parse(bookWithJson.json_data)
            : (bookWithJson.json_data as Record<string, unknown>);
      } catch (parseError) {
        logger.warn("ai_clean_json_parse_failed", { parseError });
        existingJson = {};
      }
    }

    // Merge: Existing data < AI Data (AI overrides in this specific flow)
    const finalJsonData = {
      ...existingJson,
      ...cleanAiResult,
      // Explicitly set these to ensure they aren't lost in nesting
      ddc: (cleanAiResult as any).ddc,
      lcc: (cleanAiResult as any).lcc,
      language: (cleanAiResult as any).language,
      subjects: (cleanAiResult as any).subjects,
      series: (cleanAiResult as any).series,
      edition: (cleanAiResult as any).edition,
    };

    // 5. AUDIT LOG (Smart Tracking)
    const changes: string[] = [];
    const bookRecord = book as Record<string, unknown>;
    const existingRecord = existingJson as Record<string, unknown>;
    const cleanRecord = cleanAiResult as Record<string, unknown>;

    Object.keys(cleanAiResult).forEach((key) => {
      const oldVal = bookRecord[key] || existingRecord[key];
      const newVal = cleanRecord[key];
      if (newVal && oldVal !== newVal) {
        changes.push(`Updated ${key}: ${String(newVal)}`);
      }
    });

    const logEntry = {
      timestamp: Date.now(),
      model: usedCache ? "Llama 3.3 70B Versatile (Cached)" : "Llama 3.3 70B Versatile",
      changes: changes.length > 0 ? changes : ["No changes detected"],
    };

    // Parse existing ai_log
    let existingLog: Array<{
      timestamp: number;
      model: string;
      changes: string[];
    }> = [];
    try {
      if (book.ai_log) {
        existingLog = Array.isArray(book.ai_log)
          ? book.ai_log
          : JSON.parse(String(book.ai_log));
      }
    } catch (_e) {
      logger.warn("ai_clean_parse_ai_log_failed", { error: _e });
    }

    const auditLog = [...existingLog, logEntry];

    // 6. DATABASE UPDATE
    let savedScanId: number | null = null;
    let saveError: string | null = null;

    const finalJsonString = JSON.stringify(finalJsonData);
    const auditLogString = JSON.stringify(auditLog);
    const isbnValue = book.isbn13 || book.isbn10 || book.isbn || "";
    const titleValue = cleanAiResult.title || book.title || "Untitled";

    /**
     * UPSERT LOGIC (prevents duplicate scans for same user+isbn):
     * 1. If scan_id provided → UPDATE that specific row (verify ownership)
     * 2. Else → Check if scan exists for this user+isbn → UPDATE if found
     * 3. Else → INSERT new scan
     */
    const upsertToDatabase = async (): Promise<{
      scanId: number | null;
      error: string | null;
    }> => {
      try {
        // CASE 1: scan_id provided → UPDATE existing (verify user ownership)
        if (scan_id) {
            logger.debug("ai_clean_updating_existing_scan", { scan_id });
          const result = await DB.prepare(
            `
						UPDATE scans 
						SET json_data = ?, title = ?, ai_log = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
						WHERE id = ? AND user_id = ?
					`,
          )
            .bind(finalJsonString, titleValue, auditLogString, scan_id, userId)
            .run();

          if (result.meta.changes > 0) {
            logger.info("ai_clean_scan_updated", { scan_id });
            return { scanId: scan_id, error: null };
          }
          // scan_id not found for this user, fall through to lookup by isbn
          logger.debug("ai_clean_scanid_not_found_checking_isbn", { scan_id });
        }

        // CASE 2: No scan_id or update failed → Check if scan exists for this user+isbn
        if (isbnValue) {
          const existing = await DB.prepare(
            `
						SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1
					`,
          )
            .bind(userId, isbnValue)
            .first<{ id: number }>();

          if (existing?.id) {
            // Found existing scan → UPDATE it
            logger.debug("ai_clean_found_existing_scan_updating", { isbn: isbnValue, id: existing.id });
            await DB.prepare(
              `
							UPDATE scans 
							SET json_data = ?, title = ?, ai_log = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
							WHERE id = ? AND user_id = ?
						`,
            )
              .bind(
                finalJsonString,
                titleValue,
                auditLogString,
                existing.id,
                userId,
              )
              .run();

            logger.info("ai_clean_existing_scan_updated", { id: existing.id });
            return { scanId: existing.id, error: null };
          }
        }

        // CASE 3: No existing scan → INSERT new
        logger.debug("ai_clean_inserting_new_scan", { isbn: isbnValue });
        const result = await DB.prepare(
          `
					INSERT INTO scans (user_id, isbn, title, json_data, ai_log, status)
					VALUES (?, ?, ?, ?, ?, 'completed')
				`,
        )
          .bind(userId, isbnValue, titleValue, finalJsonString, auditLogString)
          .run();

        const newId = result.meta.last_row_id as number;
        logger.info("ai_clean_inserted_new_scan", { newId });
        return { scanId: newId, error: null };
      } catch (dbError) {
        // CASE 4: Race condition - UNIQUE constraint violation
        const errorMsg =
          dbError instanceof Error ? dbError.message : String(dbError);

        if (
          errorMsg.includes("UNIQUE constraint failed") ||
          errorMsg.includes("SQLITE_CONSTRAINT")
        ) {
          logger.warn("ai_clean_race_condition_detected", { isbn: isbnValue });
          try {
            const fallback = await DB.prepare(
              `
							SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1
						`,
            )
              .bind(userId, isbnValue)
              .first<{ id: number }>();

            if (fallback?.id) {
              // Update the existing row that won the race
              await DB.prepare(
                `
								UPDATE scans 
								SET json_data = ?, title = ?, ai_log = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
								WHERE id = ? AND user_id = ?
							`,
              )
                .bind(
                  finalJsonString,
                  titleValue,
                  auditLogString,
                  fallback.id,
                  userId,
                )
                .run();

              logger.info("ai_clean_race_resolved", { id: fallback.id });
              return { scanId: fallback.id, error: null };
            }
          } catch (fallbackError) {
            logger.error("ai_clean_fallback_lookup_failed", { fallbackError });
          }
        }

        logger.error("ai_clean_db_error", { dbError });
        return { scanId: null, error: errorMsg };
      }
    };

    // Execute upsert SYNCHRONOUSLY
    const result = await upsertToDatabase();
    savedScanId = result.scanId;
    saveError = result.error;

    // Merge cleaned fields with original data
    const cleanedBook = {
      ...book,
      ...finalJsonData,
      json_data: finalJsonData as unknown,
      is_ai_enhanced: true,
      enhanced_at: Date.now(),
      ai_log: auditLog,
    } as MergedBookData & {
      json_data: unknown;
      is_ai_enhanced: boolean;
      enhanced_at: number;
      ai_log: typeof auditLog;
    };

    // Return cleaned book with save status
    return json({
      ...cleanedBook,
      saved: !saveError,
      scan_id: savedScanId,
      saveError: saveError || undefined,
      changes: changes,
    });
    } catch (err) {
    logger.error("ai_clean_endpoint_error", { err });
    return json(
      { error: "Internal Server Error", details: String(err) },
      { status: 500 },
    );
  }
};

// OPTIONS handler to support CORS preflight for Playwright custom header
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-playwright-test-session",
      "Access-Control-Max-Age": "86400",
    },
  });
};
