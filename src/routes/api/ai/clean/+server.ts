import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiService } from '$lib/server/ai';
import type { MergedBookData } from '$lib/types';

/**
 * AI Clean Endpoint with Write-Through Persistence
 * 
 * This endpoint:
 * 1. Cleans book metadata using AI
 * 2. Auto-saves to D1 database (if scan_id provided, updates; otherwise inserts)
 * 3. Uses waitUntil for non-blocking background writes
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	// Check authentication
	if (!locals.session || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as MergedBookData & { scan_id?: number };
		const { scan_id, ...book } = body;

		if (!book) {
			return json({ error: 'No book data provided' }, { status: 400 });
		}

		const cleanedFields = await aiService.cleanMetadata(book);

		// Extract internal changes array from AI response
		const aiChanges = (cleanedFields as MergedBookData & { _changes?: string[] })._changes || [];
		delete (cleanedFields as MergedBookData & { _changes?: string[] })._changes;

		// COMPREHENSIVE CHANGE DETECTION
		// Track both NEW data (filling gaps) and UPDATED data (fixing errors)
		const detectedChanges: string[] = [];
		
		/**
		 * Helper: Check if a value is "empty" or invalid for cataloging purposes
		 * Treats null, undefined, '', '-', 0, '0', and whitespace-only as INVALID
		 */
		const isEmptyOrInvalid = (val: unknown): boolean => {
			if (val === null || val === undefined) return true;
			if (typeof val === 'number') return val === 0;
			if (typeof val === 'string') {
				const trimmed = val.trim();
				return trimmed === '' || trimmed === '-' || trimmed === '0';
			}
			if (Array.isArray(val)) return val.length === 0;
			return false;
		};

		/**
		 * Helper: Check if a value is "filled" and valid
		 */
		const isFilledAndValid = (val: unknown): boolean => {
			if (val === null || val === undefined) return false;
			if (typeof val === 'number') return val !== 0;
			if (typeof val === 'string') {
				const trimmed = val.trim();
				return trimmed !== '' && trimmed !== '-' && trimmed !== '0';
			}
			if (Array.isArray(val)) return val.length > 0;
			return Boolean(val);
		};

		/**
		 * Helper: Normalize value for comparison (convert to string, trim)
		 */
		const normalizeForCompare = (val: unknown): string => {
			if (val === null || val === undefined) return '';
			if (typeof val === 'number') return String(val);
			if (typeof val === 'string') return val.trim();
			if (Array.isArray(val)) return val.join('; ');
			return String(val);
		};

		// Define all fields to monitor (these are fields AI can modify)
		const fieldsToCheck = [
			'title', 'author', 'publisher', 'description', 
			'ddc', 'lcc', 'classification',
			'language', 'series', 'edition', 'subjects', 'date', 'publishedDate'
		] as const;


		fieldsToCheck.forEach(field => {
			// Use type assertion to safely access fields that may not be in cleanedFields
			const oldVal = (book as Record<string, unknown>)[field];
			const newVal = (cleanedFields as Record<string, unknown>)[field];

			const oldEmpty = isEmptyOrInvalid(oldVal);
			const newFilled = isFilledAndValid(newVal);

			// Case 1: NEW data (filling a gap) - AI generated missing metadata
			if (oldEmpty && newFilled) {
				detectedChanges.push(`Generated ${field}: ${normalizeForCompare(newVal)}`);
			}
			// Case 2: UPDATED data (fixing existing data) - AI corrected something
			else if (!oldEmpty && newFilled) {
				const oldNorm = normalizeForCompare(oldVal);
				const newNorm = normalizeForCompare(newVal);
				if (oldNorm !== newNorm) {
					detectedChanges.push(`Updated ${field}: "${oldNorm}" → "${newNorm}"`);
				}
			}
		});

		// Special logging for DDC/LCC specifically (critical fields)
		if (isEmptyOrInvalid(book.ddc) && isFilledAndValid(cleanedFields.ddc)) {
			console.warn(`[AI Clean] DDC was empty/invalid, now filled: ${cleanedFields.ddc}`);
		}
		if (isEmptyOrInvalid(book.lcc) && isFilledAndValid(cleanedFields.lcc)) {
			console.warn(`[AI Clean] LCC was empty/invalid, now filled: ${cleanedFields.lcc}`);
		}

		// Merge AI-reported changes with our detected changes
		// Remove duplicates and combine
		const allChanges = [...new Set([...aiChanges, ...detectedChanges])];

		// Create comprehensive log entry
		const logEntry = {
			timestamp: Date.now(),
			model: 'Gemini 2.0 Flash',
			changes: allChanges.length > 0 ? allChanges : ['No changes detected']
		};

		// Merge cleaned fields with original data and append log
		const cleanedBook: MergedBookData = {
			...book,
			...cleanedFields,
			is_ai_enhanced: true,
			enhanced_at: Date.now(),
			ai_log: [...(book.ai_log || []), logEntry]
		};

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// WRITE-THROUGH PERSISTENCE: Upsert to D1 database (prevents duplicates)
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		let savedScanId: number | null = null;
		let saveError: string | null = null;

		// Safety check for D1 binding (prevents crashes in local dev without DB)
		if (platform?.env?.DB) {
			const db = platform.env.DB;
			const jsonData = JSON.stringify(cleanedBook);
			const isbn = cleanedBook.isbn13 || cleanedBook.isbn10 || cleanedBook.isbn || '';
			const title = cleanedBook.title || 'Untitled';

			/**
			 * UPSERT LOGIC (prevents duplicate scans for same user+isbn):
			 * 1. If scan_id provided → UPDATE that specific row (verify ownership)
			 * 2. Else → Check if scan exists for this user+isbn → UPDATE if found
			 * 3. Else → INSERT new scan
			 * 4. Race condition handling: If INSERT fails due to UNIQUE constraint,
			 *    catch the error and return the existing scan_id
			 */
			const upsertToDatabase = async (): Promise<{ scanId: number | null; error: string | null }> => {
				try {
					// CASE 1: scan_id provided → UPDATE existing (verify user ownership)
					if (scan_id) {
						console.warn(`[AI Clean] Updating existing scan ID: ${scan_id}`);
						const result = await db.prepare(`
							UPDATE scans 
							SET json_data = ?, title = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
							WHERE id = ? AND user_id = ?
						`).bind(jsonData, title, scan_id, userId).run();

						if (result.meta.changes > 0) {
							console.warn(`[AI Clean] ✅ Updated scan ID: ${scan_id}`);
							return { scanId: scan_id, error: null };
						}
						// scan_id not found for this user, fall through to lookup by isbn
						console.warn(`[AI Clean] scan_id ${scan_id} not found, checking by ISBN`);
					}

					// CASE 2: No scan_id or update failed → Check if scan exists for this user+isbn
					if (isbn) {
						const existing = await db.prepare(`
							SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1
						`).bind(userId, isbn).first<{ id: number }>();

						if (existing?.id) {
							// Found existing scan → UPDATE it
							console.warn(`[AI Clean] Found existing scan for ISBN ${isbn}, updating ID: ${existing.id}`);
							await db.prepare(`
								UPDATE scans 
								SET json_data = ?, title = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
								WHERE id = ? AND user_id = ?
							`).bind(jsonData, title, existing.id, userId).run();

							console.warn(`[AI Clean] ✅ Updated existing scan ID: ${existing.id}`);
							return { scanId: existing.id, error: null };
						}
					}

					// CASE 3: No existing scan → INSERT new
					console.warn(`[AI Clean] No existing scan found, inserting new for ISBN: ${isbn}`);
					const result = await db.prepare(`
						INSERT INTO scans (user_id, isbn, title, json_data, status)
						VALUES (?, ?, ?, ?, 'completed')
					`).bind(userId, isbn, title, jsonData).run();

					const newId = result.meta.last_row_id as number;
					console.warn(`[AI Clean] ✅ Inserted new scan ID: ${newId}`);
					return { scanId: newId, error: null };

				} catch (dbError) {
					// CASE 4: Race condition - UNIQUE constraint violation
					// Another request inserted while we were checking, fetch that row
					const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
					
					if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('SQLITE_CONSTRAINT')) {
						console.warn(`[AI Clean] Race condition detected, fetching existing scan for ISBN: ${isbn}`);
						try {
							const fallback = await db.prepare(`
								SELECT id FROM scans WHERE user_id = ? AND isbn = ? LIMIT 1
							`).bind(userId, isbn).first<{ id: number }>();

							if (fallback?.id) {
								// Update the existing row that won the race
								await db.prepare(`
									UPDATE scans 
									SET json_data = ?, title = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
									WHERE id = ? AND user_id = ?
								`).bind(jsonData, title, fallback.id, userId).run();

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

			// Execute upsert SYNCHRONOUSLY to ensure we return the correct scan_id
			// (waitUntil would cause race conditions and return stale/pending IDs)
			const result = await upsertToDatabase();
			savedScanId = result.scanId;
			saveError = result.error;
		} else {
			console.warn('[AI Clean] ⚠️ D1 database not available - skipping persistence');
			saveError = 'Database not configured';
		}

		// Return cleaned book with save status and scan_id for frontend to store
		return json({ 
			...cleanedBook, 
			saved: !saveError,
			scan_id: savedScanId,
			saveError: saveError || undefined
		});
	} catch (err) {
		console.error('Error in AI clean endpoint:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
