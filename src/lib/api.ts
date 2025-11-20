import type { GoogleBookItem, OpenLibraryBookData, GoogleBooksResponse, OpenLibrarySearchResponse } from './types';

/**
 * API Service Layer - Centralized API calls with enhanced error handling
 */
export class BookApiService {
	private static readonly GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
	private static readonly OPENLIBRARY_BASE = '/api/openlibrary';

	/**
	 * Fetch book data from Google Books API
	 */
	static async fetchGoogleBooks(query: string, isIsbn: boolean, maxResults = 1): Promise<GoogleBooksResponse | null> {
		const q = isIsbn ? `isbn:${query}` : `intitle:${query}`;
		const url = `${this.GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
		}

		const data: GoogleBooksResponse = await response.json();
		return data;
	}

	/**
	 * Fetch book data from OpenLibrary API (via proxy)
	 */
	static async fetchOpenLibrary(query: string, isIsbn: boolean, limit = 1): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
		const url = `${this.OPENLIBRARY_BASE}?q=${encodeURIComponent(query)}&isbn=${isIsbn}&limit=${limit}`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`OpenLibrary API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Check for API-level errors
		if (data.error) {
			throw new Error(data.error);
		}

		if (isIsbn) {
			const key = `ISBN:${query}`;
			return data[key] || null;
		}

		return data;
	}

	/**
	 * Fetch both APIs in parallel with timeout and error handling
	 */
	static async fetchBoth(query: string, isIsbn: boolean, googleLimit = 1, openLibraryLimit = 1): Promise<{
		google: GoogleBooksResponse | null;
		openlibrary: OpenLibraryBookData | OpenLibrarySearchResponse | null;
		errors: { google?: Error; openlibrary?: Error };
	}> {
		const timeout = 10000; // 10 second timeout

		const googlePromise = this.withTimeout(
			this.fetchGoogleBooks(query, isIsbn, googleLimit),
			timeout,
			'Google Books API timeout'
		);

		const openLibraryPromise = this.withTimeout(
			this.fetchOpenLibrary(query, isIsbn, openLibraryLimit),
			timeout,
			'OpenLibrary API timeout'
		);

		const [googleResult, openLibraryResult] = await Promise.allSettled([
			googlePromise,
			openLibraryPromise
		]);

		const result = {
			google: null as GoogleBooksResponse | null,
			openlibrary: null as OpenLibraryBookData | OpenLibrarySearchResponse | null,
			errors: {} as { google?: Error; openlibrary?: Error }
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

		return result;
	}

	/**
	 * Utility method to add timeout to promises
	 */
	private static async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
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
}

/**
 * Enhanced Cache with TTL and size limits
 */
export class ApiCache {
	private cache = new Map<string, { data: any; timestamp: number; hits: number }>();
	private readonly ttl: number;
	private readonly maxSize: number;

	constructor(ttlMs = 5 * 60 * 1000, maxSize = 100) { // 5 minutes TTL, 100 items max
		this.ttl = ttlMs;
		this.maxSize = maxSize;
	}

	get(key: string): any | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		const now = Date.now();
		if (now - entry.timestamp > this.ttl) {
			this.cache.delete(key);
			return null;
		}

		// Update hit count for analytics
		entry.hits++;
		return entry.data;
	}

	set(key: string, data: any): void {
		const now = Date.now();

		// Evict oldest entries if at capacity
		if (this.cache.size >= this.maxSize) {
			const oldestKey = Array.from(this.cache.entries())
				.sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0];
			this.cache.delete(oldestKey);
		}

		this.cache.set(key, { data, timestamp: now, hits: 0 });
	}

	clear(): void {
		this.cache.clear();
	}

	getStats() {
		const entries = Array.from(this.cache.values());
		return {
			size: this.cache.size,
			totalHits: entries.reduce((sum, entry) => sum + entry.hits, 0),
			averageAge: entries.length > 0
				? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length
				: 0
		};
	}
}

// Global cache instances
export const googleCache = new ApiCache();
export const openLibraryCache = new ApiCache();