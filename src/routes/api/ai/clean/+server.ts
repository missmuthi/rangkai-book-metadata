import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateObject } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { deepClean, normalizeKeys } from '$lib/utils/metadata';
import type { MergedBookData } from '$lib/types';

// Define the Schema STRICTLY
const metadataSchema = z.object({
  title: z.string(),
  publisher: z.string().describe('Format: Place : Publisher, Year'),
  authors: z.array(z.string()).describe('List of authors without titles like Ph.D'),
  description: z.string().describe('Concise 2-sentence summary'),
  
  // The Critical Fields
  ddc: z.string().describe('Dewey Decimal Code. ESTIMATE if unknown. Ex: 005.1'),
  lcc: z.string().describe('Library of Congress Code. ESTIMATE if unknown. Ex: QA76'),
  language: z.string().describe('ISO 639-2 code (e.g. eng, ind)'),
  subjects: z.string().describe('Semicolon separated subject headings'),
  series: z.string().optional(),
  edition: z.string().optional(),
});

/**
 * AI Clean Endpoint with Write-Through Persistence
 * 
 * This endpoint:
 * 1. Cleans book metadata using AI with aggressive completion
 * 2. Deep merges data to prevent loss
 * 3. Auto-saves to D1 database with audit log
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	// Check authentication
	if (!locals.session || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const DB = platform?.env?.DB;

	try {
		const body = (await request.json()) as MergedBookData & { scan_id?: number; mode?: string };
		const { scan_id, mode = 'fill_gaps', ...book } = body;

		if (!book || !DB) {
			return json({ error: 'No book data provided or DB unavailable' }, { status: 400 });
		}

		// 1. AGGRESSIVE SYSTEM PROMPT
		const systemPrompt = `
			You are an expert Library Cataloger. Your job is to COMPLETE bibliographic records.
			
			CRITICAL RULES:
			1. NEVER return empty strings for 'ddc' or 'lcc'. 
			2. If exact classification is unknown, ESTIMATE based on Title/Subject.
			3. Infer 'language' from the title text.
			4. Format Publisher as "Place : Publisher, Year".
			5. Clean "json_data" is better than empty "json_data".
			
			Current Book Data: ${JSON.stringify(book)}
		`;

		// 2. GENERATE DATA
		const { object: rawAiResult } = await generateObject({
			model: google('gemini-2.0-flash-exp'),
			schema: metadataSchema,
			system: systemPrompt,
			prompt: `Fix and Complete metadata for: "${book.title}" by ${book.author || 'Unknown'}`
		});

		// 3. NORMALIZE & OPTIMIZE
		const aiResult = normalizeKeys(rawAiResult);
		const cleanAiResult = deepClean(aiResult);

		// 4. DEEP MERGE (The Fix for Data Loss)
		// Parse existing JSON from book data (may be in json_data field or scattered in book object)
		const bookWithJson = book as MergedBookData & { json_data?: string | object };
		const existingJson = bookWithJson.json_data ? 
			(typeof bookWithJson.json_data === 'string' ? JSON.parse(bookWithJson.json_data) : bookWithJson.json_data) 
			: {};
		
		// Merge: Existing data < AI Data (AI overrides in this specific flow)
		const finalJsonData = {
			...existingJson,
			...cleanAiResult, 
			// Explicitly set these to ensure they aren't lost in nesting
			ddc: cleanAiResult.ddc,
			lcc: cleanAiResult.lcc,
			language: cleanAiResult.language,
			subjects: cleanAiResult.subjects,
			series: cleanAiResult.series,
			edition: cleanAiResult.edition,
		};

		// 5. AUDIT LOG (Smart Tracking)
		const changes: string[] = [];
		Object.keys(cleanAiResult).forEach(key => {
			const oldVal = (book as any)[key] || (existingJson as any)[key];
			const newVal = (cleanAiResult as any)[key];
			if (newVal && oldVal !== newVal) {
				changes.push(`Updated ${key}: ${newVal}`);
			}
		});

		const logEntry = {
			timestamp: Date.now(),
			model: 'Gemini 2.0 Flash',
			changes: changes.length > 0 ? changes : ['No changes detected']
		};

		// Parse existing ai_log
		let existingLog: any[] = [];
		try {
			if (book.ai_log) {
				existingLog = Array.isArray(book.ai_log) ? book.ai_log : JSON.parse(book.ai_log as any);
			}
		} catch (e) {
			console.error('Failed to parse ai_log:', e);
		}

		const auditLog = [...existingLog, logEntry];

		// 6. DATABASE UPDATE
		let savedScanId: number | null = null;
		let saveError: string | null = null;

		const finalJsonString = JSON.stringify(finalJsonData);
		const auditLogString = JSON.stringify(auditLog);
		const isbnValue = book.isbn13 || book.isbn10 || book.isbn || '';
		const titleValue = cleanAiResult.title || book.title || 'Untitled';

		/**
		 * UPSERT LOGIC (prevents duplicate scans for same user+isbn):
		 * 1. If scan_id provided → UPDATE that specific row (verify ownership)
		 * 2. Else → Check if scan exists for this user+isbn → UPDATE if found
		 * 3. Else → INSERT new scan
		 */
		const upsertToDatabase = async (): Promise<{ scanId: number | null; error: string | null }> => {
			try {
				// CASE 1: scan_id provided → UPDATE existing (verify user ownership)
				if (scan_id) {
					console.warn(`[AI Clean] Updating existing scan ID: ${scan_id}`);
					const result = await DB.prepare(`
						UPDATE scans 
						SET json_data = ?, title = ?, ai_log = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
						WHERE id = ? AND user_id = ?
					`).bind(finalJsonString, titleValue, auditLogString, scan_id, userId).run();

					if (result.meta.changes > 0) {
						console.warn(`[AI Clean] ✅ Updated scan ID: ${scan_id}`);
						return { scanId: scan_id, error: null };
					}
					// scan_id not found for this user, fall through to lookup by isbn
					console.warn(`[AI Clean] scan_id ${scan_id} not found, checking by ISBN`);
				}

				// CASE 2: No scan_id or update failed → Check if scan exists for this user+isbn
				if (isbnValue) {
					const existing = await DB.prepare(`
						SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1
					`).bind(userId, isbnValue).first<{ id: number }>();

					if (existing?.id) {
						// Found existing scan → UPDATE it
						console.warn(`[AI Clean] Found existing scan for ISBN ${isbnValue}, updating ID: ${existing.id}`);
						await DB.prepare(`
							UPDATE scans 
							SET json_data = ?, title = ?, ai_log = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
							WHERE id = ? AND user_id = ?
						`).bind(finalJsonString, titleValue, auditLogString, existing.id, userId).run();

						console.warn(`[AI Clean] ✅ Updated existing scan ID: ${existing.id}`);
						return { scanId: existing.id, error: null };
					}
				}

				// CASE 3: No existing scan → INSERT new
				console.warn(`[AI Clean] No existing scan found, inserting new for ISBN: ${isbnValue}`);
				const result = await DB.prepare(`
					INSERT INTO scans (user_id, isbn, title, json_data, ai_log, status)
					VALUES (?, ?, ?, ?, ?, 'completed')
				`).bind(userId, isbnValue, titleValue, finalJsonString, auditLogString).run();

				const newId = result.meta.last_row_id as number;
				console.warn(`[AI Clean] ✅ Inserted new scan ID: ${newId}`);
				return { scanId: newId, error: null };

			} catch (dbError) {
				// CASE 4: Race condition - UNIQUE constraint violation
				const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
				
				if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('SQLITE_CONSTRAINT')) {
					console.warn(`[AI Clean] Race condition detected, fetching existing scan for ISBN: ${isbnValue}`);
					try {
						const fallback = await DB.prepare(`
							SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1
						`).bind(userId, isbnValue).first<{ id: number }>();

						if (fallback?.id) {
							// Update the existing row that won the race
							await DB.prepare(`
								UPDATE scans 
								SET json_data = ?, title = ?, ai_log = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
								WHERE id = ? AND user_id = ?
							`).bind(finalJsonString, titleValue, auditLogString, fallback.id, userId).run();

							console.warn(`[AI Clean] ✅ Race resolved, updated scan ID: ${fallback.id}`);
							return { scanId: fallback.id, error: null };
						}
					} catch (fallbackError) {
						console.error('[AI Clean] Fallback lookup failed:', fallbackError);
					}
				}

				console.error('[AI Clean] Database error:', dbError);
				return { scanId: null, error: errorMsg };
			}
		};

		// Execute upsert SYNCHRONOUSLY
		const result = await upsertToDatabase();
		savedScanId = result.scanId;
		saveError = result.error;

		// Merge cleaned fields with original data
		const cleanedBook: MergedBookData = {
			...book,
			...finalJsonData,
			json_data: finalJsonData,
			is_ai_enhanced: true,
			enhanced_at: Date.now(),
			ai_log: auditLog
		};

		// Return cleaned book with save status
		return json({ 
			...cleanedBook, 
			saved: !saveError,
			scan_id: savedScanId,
			saveError: saveError || undefined,
			changes: changes
		});
	} catch (err) {
		console.error('Error in AI clean endpoint:', err);
		return json({ error: 'Internal Server Error', details: String(err) }, { status: 500 });
	}
};
