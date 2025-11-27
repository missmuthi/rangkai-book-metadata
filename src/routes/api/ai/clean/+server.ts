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

		// Extract internal changes array if present
		const changes = (cleanedFields as any)._changes || [];
		delete (cleanedFields as any)._changes;

		// Create log entry
		const logEntry = {
			timestamp: Date.now(),
			model: 'Gemini 2.0',
			changes: changes.length > 0 ? changes : []
		};

		// Merge cleaned fields with original data and append log
		const cleanedBook = {
			...book,
			...cleanedFields,
			ai_log: [...(book.ai_log || []), logEntry]
		};

		return json(cleanedBook);
	} catch (err) {
		console.error('Error in AI clean endpoint:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
