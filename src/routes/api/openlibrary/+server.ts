
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryOpenLibrary } from '$lib/services/openlibrary';

/**
 * Server-side proxy for OpenLibrary API to avoid CORS issues
 * Handles both ISBN lookups and title searches
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const isIsbn = url.searchParams.get('isbn') === 'true';
	const limit = url.searchParams.get('limit') || '10';

	if (!query) {
		return json({ error: 'Query parameter "q" is required' }, { status: 400 });
	}

	const data = await queryOpenLibrary(query, isIsbn, limit);

	if (data.error) {
		if (data.error.includes('temporarily unavailable')) {
			return json({ error: data.error }, { status: 503 });
		}
		if (data.error.includes('rate limit')) {
			return json({ error: data.error }, { status: 429 });
		}
		return json({ error: data.error }, { status: 500 });
	}

	return json(data, {
		headers: {
			'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
		}
	});
};
