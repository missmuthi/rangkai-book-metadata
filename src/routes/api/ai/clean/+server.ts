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

		// Define all fields to monitor
		const fieldsToCheck = [
			'title', 'author', 'publisher', 'description', 
			'ddc', 'lcc', 'classification',
			'language', 'series', 'edition', 'subjects', 'date', 'publishedDate'
		];

		fieldsToCheck.forEach(field => {
			const oldVal = book[field as keyof MergedBookData];
			const newVal = cleanedFields[field as keyof typeof cleanedFields];

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
		// WRITE-THROUGH PERSISTENCE: Auto-save to D1 database
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		let savedScanId: number | null = null;
		let saveError: string | null = null;

		// Safety check for D1 binding (prevents crashes in local dev without DB)
		if (platform?.env?.DB) {
			const db = platform.env.DB;
			const jsonData = JSON.stringify(cleanedBook);
			const isbn = cleanedBook.isbn13 || cleanedBook.isbn10 || cleanedBook.isbn || '';
			const title = cleanedBook.title || 'Untitled';

			const saveToDatabase = async () => {
				try {
					if (scan_id) {
						// UPDATE existing scan (verify user ownership for RLS)
						console.warn(`[AI Clean] Updating existing scan ID: ${scan_id}`);
						const result = await db.prepare(`
							UPDATE scans 
							SET json_data = ?, title = ?, updated_at = CURRENT_TIMESTAMP
							WHERE id = ? AND user_id = ?
						`).bind(jsonData, title, scan_id, userId).run();

						if (result.meta.changes === 0) {
							console.error(`[AI Clean] Update failed - scan ${scan_id} not found or unauthorized`);
							saveError = 'Scan not found or unauthorized';
						} else {
							savedScanId = scan_id;
							console.warn(`[AI Clean] ✅ Updated scan ID: ${scan_id}`);
						}
					} else {
						// INSERT new scan
						console.warn(`[AI Clean] Inserting new scan for ISBN: ${isbn}`);
						const result = await db.prepare(`
							INSERT INTO scans (user_id, isbn, title, json_data, status)
							VALUES (?, ?, ?, ?, 'completed')
						`).bind(userId, isbn, title, jsonData).run();

						savedScanId = result.meta.last_row_id as number;
						console.warn(`[AI Clean] ✅ Inserted new scan ID: ${savedScanId}`);
					}
				} catch (dbError) {
					console.error('[AI Clean] Database error:', dbError);
					saveError = dbError instanceof Error ? dbError.message : 'Database write failed';
				}
			};

			// Use waitUntil for non-blocking background write (Cloudflare Workers pattern)
			if (platform?.context?.waitUntil) {
				platform.context.waitUntil(saveToDatabase());
				// Return immediately, DB write happens in background
				return json({ 
					...cleanedBook, 
					saved: true, 
					scan_id: scan_id || 'pending',
					_saveNote: 'Saving in background'
				});
			} else {
				// Fallback: synchronous save (local dev)
				await saveToDatabase();
			}
		} else {
			console.warn('[AI Clean] ⚠️ D1 database not available - skipping persistence');
			saveError = 'Database not configured';
		}

		// Return cleaned book with save status
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
