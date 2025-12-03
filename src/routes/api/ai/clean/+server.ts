import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { generateObject, generateText } from "ai";
import { logger } from "$lib/server/logger";
import { Analytics } from "$lib/services/analytics";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { deepClean, normalizeKeys } from "$lib/utils/metadata";
import { normalizeISBN } from "$lib/isbn-helpers";
import type { MergedBookData } from "$lib/types";
import { createScanSnapshot } from "$lib/server/versioning";

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

// Helpers
function safeString(value: unknown) {
  try {
    if (value === undefined) return "<undefined>";
    if (value === null) return "<null>";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  } catch (_e) {
    return "<unserializable>";
  }
}

// NOTE: isValueEmpty could be added back if needed; keeping small helpers minimal to avoid lint

/**
 * AI Clean Endpoint
 *
 * This endpoint:
 * 1. Cleans book metadata using AI
 * 2. Deep merges data to prevent loss
 * 3. Auto-saves to D1 database
 *
 * NOTE: KV Cache usage has been removed (optimization).
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const requestStart = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  // No log aggregator transport configured for this request (removed per repo cleanup)
  // Enhanced authentication check with detailed error logging
  logger.debug("ai_clean_auth_check_started", {
    sessionExists: !!locals.session,
    userExists: !!locals.user,
    platformExists: !!platform,
    envExists: !!platform?.env,
    dbExists: !!platform?.env?.DB,
    requestId,
  });

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

    // Log request metadata for tracing
    logger.info("ai_clean_request_received", {
      userId: locals.user?.id,
      scan_id,
      mode: _mode,
      title: book?.title ?? undefined,
      isbn: book?.isbn ?? book?.isbn13 ?? book?.isbn10 ?? undefined,
      requestId,
    });

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
          error: "AI service is not configured (missing GROQ_API_KEY).",
          code: "AI_NOT_CONFIGURED",
        },
        { status: 500 },
      );
    }

    const groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey,
    });

    logger.debug("ai_clean_request_validated", {
      title: book.title || "Untitled",
      isbn: book.isbn || "N/A",
    });

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
    const isbn = book.isbn13 || book.isbn10 || book.isbn;

    // NO KV CACHE CHECK - Proceed to Generate

    try {
      logger.debug("ai_clean_groq_call_started", {});
      const startTime = Date.now();

      let attempt = 0;
      let gen;
      let lastError: unknown = null;

      // RETRY LOGIC for 429 Errors
      const MAX_ATTEMPTS = 3;
      while (attempt < MAX_ATTEMPTS) {
        try {
          gen = await generateObject({
            model: groq("llama-3.3-70b-versatile"),
            schema: metadataSchema,
            system: systemPrompt,
            prompt: `Complete the bibliographic record for: "${book.title || "Unknown Title"}" by ${book.author || "Unknown Author"}. ISBN: ${book.isbn13 || book.isbn10 || book.isbn || "N/A"}`,
          });
          break; // Success
        } catch (e: unknown) {
          attempt++;
          lastError = e;
          const errorMessage = e instanceof Error ? e.message : String(e);
          const isRateLimit =
            errorMessage.includes("quota") || errorMessage.includes("429");

          if (isRateLimit && attempt < MAX_ATTEMPTS) {
            const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // cap to 10s
            logger.warn("ai_clean_rate_limit_retry", {
              attempt,
              waitTime,
              requestId,
            });
            await delay(waitTime);
            continue;
          }
          // For json_schema unsupported, break to fallback logic
          if (String(errorMessage).includes("json_schema")) {
            break;
          }
          throw e; // Non-retriable or retries exhausted
        }
      }

      rawAiResult = gen?.object ?? null;

      // If generation failed due to unsupported `json_schema` format, attempt text fallback
      if (
        !rawAiResult &&
        lastError &&
        String(lastError).includes("json_schema")
      ) {
        try {
          logger.info("ai_clean_groq_fallback_to_generateText_loop", {
            requestId,
          });
          const fallbackPromptLoop = `${systemPrompt}\n\nReturn ONLY a single valid JSON object matching the expected metadata schema. Do not include any markdown formatting, code blocks, or explanations - just the raw JSON object.`;
          const textResultLoop = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            prompt: fallbackPromptLoop,
          });

          // Vercel AI SDK returns text directly on the result object
          const outputTextLoop = textResultLoop.text;
          logger.debug("ai_clean_fallback_raw_text", {
            outputTextLoop: outputTextLoop?.substring(0, 500),
            requestId,
          });

          if (typeof outputTextLoop === "string" && outputTextLoop.trim()) {
            // Extract JSON from potential markdown code blocks or raw text
            let jsonStr = outputTextLoop.trim();
            const jsonMatch =
              jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/) ||
              jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1] || jsonMatch[0];
            }
            rawAiResult = JSON.parse(jsonStr.trim());
            try {
              Analytics.track("ai_fallback_used", {
                model: "llama-3.3-70b-versatile",
                provider: "groq",
                isbn: isbn || undefined,
                reason: "json_schema_unsupported",
                requestId,
              });
            } catch (analyticsErr) {
              logger.debug("analytics_track_failed", { analyticsErr });
            }
          }
        } catch (fallbackLoopErr) {
          logger.error("ai_clean_generateText_fallback_failed_loop", {
            fallbackLoopErr,
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info("ai_clean_groq_success", { duration, requestId });
    } catch (aiError) {
      const errorMessage =
        aiError instanceof Error ? aiError.message : String(aiError);
      logger.debug("ai_clean_groq_failed_message", { errorMessage });
      logger.error("ai_clean_groq_failed", { errorMessage });

      // Fallback for models that don't support json_schema: try a plain text JSON output and parse
      if (errorMessage.includes("json_schema")) {
        try {
          logger.info("ai_clean_groq_fallback_to_generateText", {});
          logger.debug("ai_clean_fallback_invoking_generateText_start", {});

          const fallbackPrompt = `${systemPrompt}\n\nReturn ONLY a single valid JSON object matching the expected metadata schema. Do not include any markdown formatting, code blocks, or explanations - just the raw JSON object.`;
          const textResult = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            prompt: fallbackPrompt,
          });
          logger.debug("ai_clean_fallback_invoking_generateText_end", {});

          // Vercel AI SDK returns text directly on the result object
          const outputText = textResult.text;
          logger.debug("ai_clean_fallback_raw_text", {
            outputText: outputText?.substring(0, 500),
          });

          if (typeof outputText === "string" && outputText.trim()) {
            try {
              // Extract JSON from potential markdown code blocks or raw text
              let jsonStr = outputText.trim();
              const jsonMatch =
                jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                jsonStr.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                jsonStr = jsonMatch[1] || jsonMatch[0];
              }
              rawAiResult = JSON.parse(jsonStr.trim());
              logger.debug("ai_clean_fallback_parsed", { rawAiResult });
            } catch (parseErr) {
              logger.warn("ai_clean_generateText_parse_failed", {
                parseErr,
                outputText: outputText?.substring(0, 200),
              });
            }
            try {
              Analytics.track("ai_fallback_used", {
                model: "llama-3.3-70b-versatile",
                provider: "groq",
                isbn: isbn || undefined,
                reason: "json_schema_unsupported",
                requestId,
              });
            } catch (analyticsErr) {
              logger.debug("analytics_track_failed", { analyticsErr });
            }
          }
        } catch (fallbackErr) {
          logger.error("ai_clean_generateText_fallback_failed", {
            fallbackErr,
          });
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
        logger.warn("ai_clean_fix_suggestion", {
          suggestion: "Add GROQ_API_KEY to Cloudflare Pages env",
          requestId,
        });
      } else if (
        errorMessage.includes("quota") ||
        errorMessage.includes("429")
      ) {
        userMessage =
          "System busy (Free Tier limit). Please wait 30 seconds and try again.";
        errorCode = "AI_QUOTA_EXCEEDED";
      } else if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED")
      ) {
        userMessage = "AI service timed out. Please try again.";
        errorCode = "AI_TIMEOUT";
      }

      logger.info("ai_clean_error_response", {
        code: errorCode,
        message: userMessage,
        requestId,
      });

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

    // 3. NORMALIZE & OPTIMIZE
    if (!rawAiResult) {
      logger.warn("ai_clean_no_ai_result", {});
    }
    logger.debug("ai_clean_raw_result", { rawAiResult });
    // moved log to after aiResult/cleanAiResult are defined below
    const aiResult = normalizeKeys(
      (rawAiResult ?? {}) as import("$lib/utils/metadata").AIResultInput,
    );
    const cleanAiResult = deepClean(aiResult) ?? {};
    logger.debug("ai_clean_normalized", { aiResult, cleanAiResult });
    // Additional parsed AI result information for tracing without logging sensitive or large payloads
    logger.debug("ai_clean_parsed_ai_result", {
      requestId,
      keys: Object.keys(cleanAiResult || {}),
      title: safeString((cleanAiResult as Record<string, unknown>)?.title),
      ddc: safeString((cleanAiResult as Record<string, unknown>)?.ddc),
      lcc: safeString((cleanAiResult as Record<string, unknown>)?.lcc),
    });

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
      ddc: (cleanAiResult as Partial<MergedBookData>).ddc,
      lcc: (cleanAiResult as Partial<MergedBookData>).lcc,
      language: (cleanAiResult as Partial<MergedBookData>).language,
      subjects: (cleanAiResult as Partial<MergedBookData>).subjects,
      series: (cleanAiResult as Partial<MergedBookData>).series,
      edition: (cleanAiResult as Partial<MergedBookData>).edition,
    };

    // 5. AUDIT LOG (Smart Tracking)
    const changes: string[] = [];
    const bookRecord = book as Record<string, unknown>;
    const existingRecord = existingJson as Record<string, unknown>;
    const cleanRecord = cleanAiResult as Record<string, unknown>;

    Object.keys(cleanAiResult).forEach((key) => {
      // FIX: Prioritize bookRecord if key exists (even if empty/null) to detect filling gaps
      // properly. Original logic `bookRecord[key] || existingRecord[key]` masked empty fields
      // by falling back to potentially stale existingRecord.
      const oldVal = key in bookRecord ? bookRecord[key] : existingRecord[key];
      const newVal = cleanRecord[key];

      logger.debug(`ai_clean_compare_${key}`, {
        key,
        oldVal: safeString(oldVal),
        newVal: safeString(newVal),
        oldType: typeof oldVal,
        newType: typeof newVal,
        match: oldVal === newVal,
        requestId,
      });

      if (newVal && oldVal !== newVal) {
        changes.push(`Updated ${key}: ${String(newVal)}`);
      }
    });

    const logEntry = {
      timestamp: Date.now(),
      model: "Llama 3.3 70B Versatile",
      changes: changes.length > 0 ? changes : ["No changes detected"],
    };

    if (changes.length === 0) {
      logger.warn("ai_clean_no_changes", {
        requestId,
        title: book.title || undefined,
        isbn: book.isbn || book.isbn13 || book.isbn10 || undefined,
      });
    } else {
      logger.info("ai_clean_changes_detected", {
        requestId,
        changesCount: changes.length,
      });
    }

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
    const isbnRaw = book.isbn13 || book.isbn10 || book.isbn || "";
    const isbnValue =
      isbnRaw && typeof isbnRaw === "string" ? normalizeISBN(isbnRaw) : "";
    const titleValue = cleanAiResult.title || book.title || "Untitled";

    /**
     * UPSERT LOGIC (prevents duplicate scans for same user+isbn):
     * 1. If scan_id provided → UPDATE that specific row (verify ownership)
     * 2. Else → Check if scan exists for this user+isbn → UPDATE if found
     * 3. Else → INSERT new scan
     *
     * NOTE: Before updating existing scans, creates a snapshot in scans_history
     * for audit and recovery purposes.
     */
    const upsertToDatabase = async (): Promise<{
      scanId: number | null;
      error: string | null;
    }> => {
      try {
        // CASE 1: scan_id provided → UPDATE existing (verify user ownership)
        if (scan_id) {
          logger.debug("ai_clean_updating_existing_scan", {
            scan_id,
            requestId,
          });

          // Create snapshot before updating
          await createScanSnapshot(DB, scan_id, requestId);

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
          logger.debug("ai_clean_scanid_not_found_checking_isbn", {
            scan_id,
            requestId,
          });
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
            // Found existing scan → Create snapshot then UPDATE it
            logger.debug("ai_clean_found_existing_scan_updating", {
              isbn: isbnValue,
              id: existing.id,
              requestId,
            });

            // Create snapshot before updating
            await createScanSnapshot(DB, existing.id, requestId);

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

        // CASE 3: No existing scan → INSERT new (no snapshot needed)
        logger.debug("ai_clean_inserting_new_scan", {
          isbn: isbnValue,
          requestId,
        });
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
          logger.warn("ai_clean_race_condition_detected", {
            isbn: isbnValue,
            requestId,
          });
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
              // Create snapshot before updating
              await createScanSnapshot(DB, fallback.id, requestId);

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

              logger.info("ai_clean_race_resolved", {
                id: fallback.id,
                requestId,
              });
              return { scanId: fallback.id, error: null };
            }
          } catch (fallbackError) {
            logger.error("ai_clean_fallback_lookup_failed", { fallbackError });
          }
        }

        logger.error("ai_clean_db_error", { dbError, requestId });
        return { scanId: null, error: errorMsg };
      }
    };

    // Execute upsert SYNCHRONOUSLY
    const dbResult = await upsertToDatabase();
    savedScanId = dbResult.scanId;
    saveError = dbResult.error;

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
    logger.info("ai_clean_complete", {
      requestId,
      savedScanId,
      changesCount: changes.length,
      saved: !saveError,
    });

    try {
      // Track basic latency and success as a scan_latency event
      Analytics.track("scan_latency", {
        duration: Date.now() - requestStart,
      });
    } catch (analyticsErr) {
      logger.debug("analytics_track_failed", { analyticsErr });
    }

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
