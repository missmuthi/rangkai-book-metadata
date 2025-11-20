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
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'application/json',
				'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
			}
		});

		if (!response.ok) {
			console.error(`OpenLibrary API error: ${response.status} ${response.statusText}`);
			
			// Special handling for rate limiting and service unavailability
			if (response.status === 429 || response.status === 503) {
				console.warn('⚠️ OpenLibrary rate limit or service unavailable - client should use cached data or Google Books only');
				return json(
					{ error: 'OpenLibrary temporarily unavailable', retryAfter: response.headers.get('Retry-After') || '60' },
					{ status: response.status }
				);
			}
			
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
