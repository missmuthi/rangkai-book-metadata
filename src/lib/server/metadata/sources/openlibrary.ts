/**
 * OpenLibrary API adapter
 * 
 * Handles all interactions with OpenLibrary API via proxy.
 * Part of the metadata engine's source adapters.
 */

import type { OpenLibraryBookData, OpenLibrarySearchResponse } from '$lib/types';
import { Analytics } from '$lib/services/analytics';
import { logger, LogEvents } from '$lib/server/log';

const OPENLIBRARY_PROXY = '/api/openlibrary';
const DEFAULT_TIMEOUT = 3000; // 3 seconds (fail fast, secondary source)

/**
 * Fetch book data from OpenLibrary API (via proxy)
 * Gracefully handles rate limiting and service unavailability
 * 
 * @param query - Search query (ISBN or title)
 * @param isIsbn - Whether the query is an ISBN
 * @param limit - Maximum number of results to return
 * @returns OpenLibrary API response or null
 */
export async function fetchOpenLibrary(
	query: string,
	isIsbn: boolean,
	limit = 1
): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
	const startTime = performance.now();
	const url = `${OPENLIBRARY_PROXY}?q=${encodeURIComponent(query)}&isbn=${isIsbn}&limit=${limit}`;

	try {
		const response = await fetch(url);
		const duration = Math.round(performance.now() - startTime);
		
		// Graceful degradation: Don't throw on 503/429, return null to allow Google Books fallback
		if (!response.ok) {
			const errorType = response.status === 503 ? 'api_503' : response.status === 429 ? 'rate_limit' : 'unknown';
			Analytics.track('error_occurred', {
				error_type: errorType,
				source: 'openlibrary',
				message: `${response.status} ${response.statusText}`
			});

			if (response.status === 503 || response.status === 429) {
				logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
					provider: 'openlibrary',
					status: response.status,
					fallback: 'google_books'
				});
				return null; // Allow the app to continue with Google Books data
			}
			throw new Error(`OpenLibrary API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Check for API-level errors
		if (data.error) {
			// Graceful degradation for temporary unavailability
			if (data.error.includes('temporarily unavailable') || data.error.includes('rate limit')) {
				Analytics.track('error_occurred', {
					error_type: 'rate_limit',
					source: 'openlibrary',
					message: data.error
				});
				logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
					provider: 'openlibrary',
					reason: 'temporarily_unavailable',
					fallback: 'google_books'
				});
				return null;
			}
			throw new Error(data.error);
		}

		// Track API timing
		Analytics.track('api_timing', {
			source: 'openlibrary',
			endpoint: isIsbn ? 'isbn_search' : 'title_search',
			duration_ms: duration,
			success: true
		});

		if (isIsbn) {
			const key = `ISBN:${query}`;
			return data[key] || null;
		}

		return data;
	} catch (error) {
		const duration = Math.round(performance.now() - startTime);
		Analytics.track('api_timing', {
			source: 'openlibrary',
			endpoint: isIsbn ? 'isbn_search' : 'title_search',
			duration_ms: duration,
			success: false
		});
		logger.error(LogEvents.METADATA_FETCH_FAILED, {
			provider: 'openlibrary',
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
export async function fetchOpenLibraryWithTimeout(
	query: string,
	isIsbn: boolean,
	limit = 1,
	timeoutMs = DEFAULT_TIMEOUT
): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
	return withTimeout(
		fetchOpenLibrary(query, isIsbn, limit),
		timeoutMs,
		'OpenLibrary API timeout'
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
