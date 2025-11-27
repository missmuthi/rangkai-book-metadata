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
		const aiChanges = (cleanedFields as any)._changes || [];
		delete (cleanedFields as any)._changes;

		// COMPREHENSIVE CHANGE DETECTION
		// Track both NEW data (filling gaps) and UPDATED data (fixing errors)
		const detectedChanges: string[] = [];
		
		// Define all fields to monitor
		const fieldsToCheck = [
			'title', 'author', 'publisher', 'description', 
			'ddc', 'lcc', 'classification',
			'language', 'series', 'edition', 'subjects', 'date'
		];

		fieldsToCheck.forEach(field => {
			const oldVal = book[field as keyof MergedBookData];
			const newVal = cleanedFields[field as keyof typeof cleanedFields];

			// Normalize empty values (treat '-', '', null, undefined as empty)
			const isOldEmpty = !oldVal || oldVal === '-' || oldVal === '';
			const isNewFilled = newVal && newVal !== '-' && newVal !== '';

			// Case 1: NEW data (filling a gap) - AI generated missing metadata
			if (isOldEmpty && isNewFilled) {
				detectedChanges.push(`Generated ${field}: ${newVal}`);
			}
			// Case 2: UPDATED data (fixing existing data) - AI corrected something
			else if (!isOldEmpty && isNewFilled && oldVal !== newVal) {
				detectedChanges.push(`Updated ${field}: "${oldVal}" → "${newVal}"`);
			}
		});

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
