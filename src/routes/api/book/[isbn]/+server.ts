/**
 * High-Performance Book API Route
 * 
 * Features:
 * - KV Cache with 24-hour TTL (instant responses)
 * - 3-Source Data Fetching via metadata engine
 * - Background Writes (waitUntil pattern)
 * - Type-safe operations
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidISBN13, isValidISBN10 } from '$lib/utils';
import type { MergedBookData } from '$lib/types';
import {
	getKV,
	CacheKeys,
	CacheTTL,
	cacheGet,
	cacheSet,
	fetchBookByIsbn,
	getSourceStatus,
	getDB,
	createScan,
	createAnonymousScan
} from '$lib/server';

/**
 * GET /api/book/[isbn]
 * 
 * Performance Flow:
 * 1. Check KV cache (< 100ms if hit)
 * 2. Fetch from metadata engine (< 2.5s)
 * 3. Return response IMMEDIATELY
 * 4. Background: Write to KV (non-blocking)
 */
export const GET: RequestHandler = async ({ params, platform }) => {
	const { isbn } = params;
	const startTime = performance.now();

	// Validate ISBN format
	if (!isValidISBN13(isbn) && !isValidISBN10(isbn)) {
		throw error(400, {
			message: 'Invalid ISBN format. Must be valid ISBN-10 or ISBN-13.'
		});
	}

	// === STEP 1: Cache Check (KV) ===
	const kv = getKV(platform);
	if (kv) {
		try {
			const cached = await cacheGet<MergedBookData>(kv, CacheKeys.book(isbn));
			if (cached) {
				console.info(`✅ [Cache HIT] ${isbn} - ${Math.round(performance.now() - startTime)}ms`);
				return json(cached, {
					headers: {
						'Cache-Control': 'public, max-age=86400', // 24 hours
						'X-Cache': 'HIT',
						'X-Response-Time': `${Math.round(performance.now() - startTime)}ms`
					}
				});
			}
		} catch (cacheError) {
			console.warn('⚠️ KV cache read failed:', cacheError);
			// Continue without cache (graceful degradation)
		}
	}

	// === STEP 2: Fetch via Metadata Engine ===
	const fetchStartTime = performance.now();
	
	let mergedData: MergedBookData;
	let sources: { google: boolean; openlibrary: boolean; loc: boolean };
	
	try {
		mergedData = await fetchBookByIsbn(isbn);
		
		// Get source status from the metadata (with fallback)
		const dataSource = mergedData.dataSource || '';
		sources = {
			google: dataSource.includes('google'),
			openlibrary: dataSource.includes('openlibrary'),
			loc: dataSource.includes('loc')
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		console.error(`❌ [Fetch Error] ${isbn}:`, errorMessage);
		throw error(404, {
			message: `Book not found: ${errorMessage}`
		});
	}

	const fetchDuration = Math.round(performance.now() - fetchStartTime);
	console.info(`📚 [Fetch] ${isbn} - ${fetchDuration}ms`);

	// Add metadata
	const responseData = {
		...mergedData,
		meta: {
			isbn,
			sources,
			fetchDuration,
			totalDuration: Math.round(performance.now() - startTime),
			timestamp: new Date().toISOString()
		}
	};

	// === STEP 3: Background Tasks (waitUntil Pattern) ===
	if (platform?.context?.waitUntil) {
		const db = getDB(platform);

		// 1. Cache Write Promise
		const cacheWritePromise = (async () => {
			if (kv) {
				try {
					await cacheSet(kv, CacheKeys.book(isbn), responseData, CacheTTL.book);
					console.info(`✅ [KV Write] ${isbn} cached`);
				} catch (kvError) {
					console.error('❌ [KV Write Error]:', kvError);
				}
			}
		})();

		// 2. Scan Logging Promise (Anonymous - API endpoints don't have session context)
		const scanLogPromise = (async () => {
			try {
				const title = responseData.title || 'Unknown Title';
				const jsonData = JSON.stringify(responseData);

				await createAnonymousScan(db, isbn, title, jsonData);
				console.info(`✅ [DB Log] Anonymous scan logged`);
			} catch (dbError) {
				console.error('❌ [DB Write Error]:', dbError);
			}
		})();

		// Schedule both background tasks to complete after response is sent
		platform.context.waitUntil(Promise.allSettled([cacheWritePromise, scanLogPromise]));
	} else if (!kv) {
		console.warn('⚠️ KV not available - caching skipped');
	} else {
		console.warn('⚠️ waitUntil not available - background cache write skipped');
	}

	// === STEP 4: Return Response Immediately ===
	const totalDuration = Math.round(performance.now() - startTime);
	console.info(`🚀 [Response] ${isbn} - ${totalDuration}ms (cache miss)`);

	return json(responseData, {
		headers: {
			'Cache-Control': 'public, max-age=3600', // 1 hour
			'X-Cache': 'MISS',
			'X-Response-Time': `${totalDuration}ms`,
			'X-Sources': JSON.stringify(sources)
		}
	});
};

/**
 * OPTIONS handler for CORS preflight
 */
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '86400'
		}
	});
};
