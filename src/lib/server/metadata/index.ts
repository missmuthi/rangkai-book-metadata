/**
 * Metadata Engine - Public API
 * 
 * Facade for fetching and merging book metadata from multiple sources.
 * Provides a clean, high-level API for routes to consume.
 */

import type { GoogleBooksResponse, OpenLibraryBookData, OpenLibrarySearchResponse, LoCBookData, MergedBookData } from '$lib/types';
import { fetchGoogleBooksWithTimeout } from './sources/google-books';
import { fetchOpenLibraryWithTimeout } from './sources/openlibrary';
import { fetchLibraryOfCongressWithTimeout } from './sources/loc';
import { processAndRenderMergedData } from '$lib/merge';

/**
 * Timeout configuration for each source
 */
const TIMEOUTS = {
	google: 10000, // 10 seconds
	openlibrary: 3000, // 3 seconds (fail fast, secondary source)
	loc: 5000, // 5 seconds (LoC can be slow, fail fast)
} as const;

/**
 * Result type for multi-source fetch
 */
export interface MetadataFetchResult {
	google: GoogleBooksResponse | null;
	openlibrary: OpenLibraryBookData | OpenLibrarySearchResponse | null;
	loc: LoCBookData | null;
	errors: {
		google?: Error;
		openlibrary?: Error;
		loc?: Error;
	};
}

/**
 * Fetch book metadata by ISBN from all three sources
 * Uses Promise.allSettled for parallel fetching with graceful degradation
 * 
 * @param isbn - ISBN-10 or ISBN-13 identifier
 * @returns Merged book data with metadata from all available sources
 * 
 * @example
 * ```ts
 * const book = await fetchBookByIsbn('9780134092669');
 * console.log(book.title, book.lcc, book.dataSource);
 * ```
 */
export async function fetchBookByIsbn(fetchFn: typeof fetch, isbn: string): Promise<MergedBookData> {
	// Fetch from all three sources in parallel
	const result = await fetchAllSources(fetchFn, isbn, true);

	// Check if we have at least one data source
	if (!result.google && !result.openlibrary && !result.loc) {
		const errorDetails = [
			result.errors.google?.message && `Google: ${result.errors.google.message}`,
			result.errors.openlibrary?.message && `OpenLibrary: ${result.errors.openlibrary.message}`,
			result.errors.loc?.message && `LoC: ${result.errors.loc.message}`
		].filter(Boolean).join('; ');
		
		throw new Error(`Book not found. ${errorDetails || 'All data sources unavailable.'}`);
	}

	// Merge data from all sources
	const googleVolumeInfo = result.google?.items?.[0]?.volumeInfo || null;
	const mergedData = processAndRenderMergedData(
		googleVolumeInfo,
		result.openlibrary,
		result.loc
	);

	return mergedData;
}

/**
 * Search for books by title from available sources
 * 
 * @param title - Book title to search for
 * @param limit - Maximum number of results (default: 10)
 * @returns Search results from Google Books and OpenLibrary
 * 
 * @example
 * ```ts
 * const results = await searchBooksByTitle('Clean Code');
 * console.log(results.google?.items?.length);
 * ```
 */
export async function searchBooksByTitle(
	fetchFn: typeof fetch,
	title: string,
	limit = 10
): Promise<MetadataFetchResult> {
	// LoC doesn't support title search, only ISBN
	return fetchAllSources(fetchFn, title, false, limit, limit);
}

/**
 * Core function to fetch from all sources in parallel
 * "Waterfall of Data" - Prioritizes best sources for each data type
 * 
 * @param query - Search query (ISBN or title)
 * @param isIsbn - Whether the query is an ISBN
 * @param googleLimit - Max results from Google Books
 * @param openLibraryLimit - Max results from OpenLibrary
 * @returns Metadata from all sources with error tracking
 */
export async function fetchAllSources(
	fetchFn: typeof fetch,
	query: string,
	isIsbn: boolean,
	googleLimit = 1,
	openLibraryLimit = 1
): Promise<MetadataFetchResult> {
	// Execute all three API calls in parallel
	const googlePromise = fetchGoogleBooksWithTimeout(fetchFn, query, isIsbn, googleLimit, TIMEOUTS.google);
	const openLibraryPromise = fetchOpenLibraryWithTimeout(fetchFn, query, isIsbn, openLibraryLimit, TIMEOUTS.openlibrary);
	
	// LoC only supports ISBN search
	const locPromise = isIsbn 
		? fetchLibraryOfCongressWithTimeout(fetchFn, query, TIMEOUTS.loc)
		: Promise.resolve(null);

	const [googleResult, openLibraryResult, locResult] = await Promise.allSettled([
		googlePromise,
		openLibraryPromise,
		locPromise
	]);

	const result: MetadataFetchResult = {
		google: null,
		openlibrary: null,
		loc: null,
		errors: {}
	};

	if (googleResult.status === 'fulfilled') {
		result.google = googleResult.value;
	} else {
		result.errors.google = googleResult.reason;
	}

	if (openLibraryResult.status === 'fulfilled') {
		result.openlibrary = openLibraryResult.value;
	} else {
		result.errors.openlibrary = openLibraryResult.reason;
	}

	if (locResult.status === 'fulfilled') {
		result.loc = locResult.value;
	} else {
		result.errors.loc = locResult.reason;
	}

	return result;
}

/**
 * Get metadata source availability status
 * Useful for health checks and monitoring
 */
export function getSourceStatus(result: MetadataFetchResult) {
	return {
		google: !!result.google,
		openlibrary: !!result.openlibrary,
		loc: !!result.loc,
		totalAvailable: [!!result.google, !!result.openlibrary, !!result.loc].filter(Boolean).length,
		hasErrors: Object.keys(result.errors).length > 0
	};
}
