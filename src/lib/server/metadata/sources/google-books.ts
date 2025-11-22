/**
 * Google Books API adapter
 * 
 * Handles all interactions with Google Books API.
 * Part of the metadata engine's source adapters.
 */

import type { GoogleBooksResponse } from '$lib/types';
import { Analytics } from '$lib/services/analytics';
import { logger, LogEvents } from '$lib/server/log';

const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch book data from Google Books API
 * 
 * @param query - Search query (ISBN or title)
 * @param isIsbn - Whether the query is an ISBN
 * @param maxResults - Maximum number of results to return
 * @returns Google Books API response or null
 */
export async function fetchGoogleBooks(
	query: string,
	isIsbn: boolean,
	maxResults = 1
): Promise<GoogleBooksResponse | null> {
	const startTime = performance.now();
	const q = isIsbn ? `isbn:${query}` : `intitle:${query}`;
	const url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;

	try {
		const response = await fetch(url);
		const duration = Math.round(performance.now() - startTime);

		if (!response.ok) {
			const errorType = response.status === 503 ? 'api_503' : response.status === 429 ? 'rate_limit' : 'unknown';
			Analytics.track('error_occurred', {
				error_type: errorType,
				source: 'google',
				message: `${response.status} ${response.statusText}`
			});
			throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
		}

		const data: GoogleBooksResponse = await response.json();
		
		// Track API timing
		Analytics.track('api_timing', {
			source: 'google',
			endpoint: isIsbn ? 'isbn_search' : 'title_search',
			duration_ms: duration,
			success: true
		});

		return data;
	} catch (error) {
		const duration = Math.round(performance.now() - startTime);
		Analytics.track('api_timing', {
			source: 'google',
			endpoint: isIsbn ? 'isbn_search' : 'title_search',
			duration_ms: duration,
			success: false
		});
		logger.error(LogEvents.METADATA_FETCH_FAILED, {
			provider: 'google_books',
			query,
			isIsbn,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		throw error;
	}
}

/**
 * Fetch with timeout wrapper
 */
export async function fetchGoogleBooksWithTimeout(
	query: string,
	isIsbn: boolean,
	maxResults = 1,
	timeoutMs = DEFAULT_TIMEOUT
): Promise<GoogleBooksResponse | null> {
	return withTimeout(
		fetchGoogleBooks(query, isIsbn, maxResults),
		timeoutMs,
		'Google Books API timeout'
	);
}

/**
 * Utility to add timeout to promises
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error(timeoutMessage));
		}, timeoutMs);

		promise
			.then(resolve)
			.catch(reject)
			.finally(() => clearTimeout(timeoutId));
	});
}
