import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiService } from '$lib/server/ai';
import type { MergedBookData } from '$lib/types';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const book = (await request.json()) as MergedBookData;

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
		const cleanedBook = {
			...book,
			...cleanedFields,
			is_ai_enhanced: true,
			enhanced_at: Date.now(),
			ai_log: [...(book.ai_log || []), logEntry]
		};

		return json(cleanedBook);
	} catch (err) {
		console.error('Error in AI clean endpoint:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
