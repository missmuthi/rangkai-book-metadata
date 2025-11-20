import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

	let apiUrl: string;
	if (isIsbn) {
		apiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${query}&format=json&jscmd=data`;
	} else {
		apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
	}

	try {
		const response = await fetch(apiUrl, {
			headers: {
				'User-Agent': 'RangkaiBookMetadata/1.0 (https://github.com/missmuthi/rangkai-book-metadata)'
			}
		});

		if (!response.ok) {
			console.error(`OpenLibrary API error: ${response.status} ${response.statusText}`);
			return json(
				{ error: `OpenLibrary API error: ${response.statusText}` },
				{ status: response.status }
			);
		}

		const data = await response.json();
		
		// Return the raw data - the client will handle parsing
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
			}
		});
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		console.error('OpenLibrary API fetch error:', err);
		return json(
			{ error: `Failed to fetch from OpenLibrary: ${errorMessage}` },
			{ status: 500 }
		);
	}
};
