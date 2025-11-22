/**
 * Library of Congress API adapter
 * 
 * Handles all interactions with Library of Congress API.
 * Part of the metadata engine's source adapters.
 * Priority source for LCC (Library of Congress Classification).
 */

import type { LoCBookData } from '$lib/types';
import { Analytics } from '$lib/services/analytics';
import { logger, LogEvents } from '$lib/server/log';

const LOC_BASE = 'https://www.loc.gov/books/';
const DEFAULT_TIMEOUT = 5000; // 5 seconds (LoC can be slow, fail fast)

/**
 * Fetch book data from Library of Congress API
 * Gracefully handles timeouts and service unavailability
 * Priority source for LCC (Library of Congress Classification)
 * 
 * @param isbn - ISBN identifier
 * @returns LoC API response or null
 */
export async function fetchLibraryOfCongress(isbn: string): Promise<LoCBookData | null> {
	const startTime = performance.now();
	const url = `${LOC_BASE}?q=${encodeURIComponent(isbn)}&fo=json&at=results`;

	try {
		const response = await fetch(url);
		const duration = Math.round(performance.now() - startTime);
		
		// Graceful degradation: Don't throw on errors, return null to allow fallback
		if (!response.ok) {
			const errorType = response.status === 503 ? 'api_503' : response.status === 429 ? 'rate_limit' : 'unknown';
			Analytics.track('error_occurred', {
				error_type: errorType,
				source: 'loc',
				message: `${response.status} ${response.statusText}`
			});

			if (response.status === 503 || response.status === 429 || response.status === 404) {
				logger.warn(LogEvents.METADATA_SOURCE_DEGRADED, {
					provider: 'loc',
					status: response.status,
					fallback: 'other_sources'
				});
				return null;
			}
			throw new Error(`Library of Congress API error: ${response.status} ${response.statusText}`);
		}

		const data: LoCBookData = await response.json();
		
		// Validate that we have actual results
		if (!data.results || data.results.length === 0) {
			logger.debug('loc_no_results', { isbn });
			return null;
		}

		// Track API timing
		Analytics.track('api_timing', {
			source: 'loc',
			endpoint: 'isbn_search',
			duration_ms: duration,
			success: true
		});

		return data;
	} catch (error) {
		const duration = Math.round(performance.now() - startTime);
		
		// Track timing even for failures
		Analytics.track('api_timing', {
			source: 'loc',
			endpoint: 'isbn_search',
			duration_ms: duration,
			success: false
		});

		if (error instanceof Error && !error.message.includes('timeout')) {
			Analytics.track('error_occurred', {
				error_type: 'network_error',
				source: 'loc',
				message: error.message
			});
		}

		// Silent failure - LoC can be slow or unavailable
		logger.warn(LogEvents.METADATA_FETCH_FAILED, {
			provider: 'loc',
			isbn,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		return null;
	}
}

/**
 * Fetch with timeout wrapper
 */
export async function fetchLibraryOfCongressWithTimeout(
	isbn: string,
	timeoutMs = DEFAULT_TIMEOUT
): Promise<LoCBookData | null> {
	return withTimeout(
		fetchLibraryOfCongress(isbn),
		timeoutMs,
		'Library of Congress API timeout'
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
