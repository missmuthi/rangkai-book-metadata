/**
 * High-Performance Book API Route with waitUntil Pattern
 * Cloudflare Workers + D1 + KV + AI Integration
 * 
 * Features:
 * - KV Cache with 24-hour TTL (instant responses)
 * - 3-Source Data Fetching (Google Books + OpenLibrary + LoC)
 * - AI Enhancement with Gemini (graceful degradation)
 * - Background Writes (waitUntil pattern prevents data loss)
 * - Type-safe Cloudflare Platform bindings
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BookApiService } from '$lib/api';
import { processAndRenderMergedData } from '$lib/merge';
import { isValidISBN13, isValidISBN10 } from '$lib/utils';
import type { MergedBookData } from '$lib/types';

/**
 * GET /api/book/[isbn]
 * 
 * Performance Flow:
 * 1. Check KV cache (< 100ms if hit)
 * 2. Fetch from 3 APIs in parallel (< 2.5s)
 * 3. Merge data with waterfall prioritization
 * 4. Return response IMMEDIATELY
 * 5. Background: Write to D1 + KV (non-blocking)
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
	if (platform?.env?.BOOK_CACHE) {
		try {
			const cached = await platform.env.BOOK_CACHE.get(`book:${isbn}`, 'json');
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

	// === STEP 2: Fetch from 3 Sources ===
	const fetchStartTime = performance.now();
	const { google, openlibrary, loc, errors } = await BookApiService.fetchAll(isbn, true);
	const fetchDuration = Math.round(performance.now() - fetchStartTime);

	console.info(`📚 [Fetch] ${isbn} - ${fetchDuration}ms`);

	// Check if we have at least one data source
	if (!google && !openlibrary && !loc) {
		const errorDetails = [
			errors.google?.message && `Google: ${errors.google.message}`,
			errors.openlibrary?.message && `OpenLibrary: ${errors.openlibrary.message}`,
			errors.loc?.message && `LoC: ${errors.loc.message}`
		].filter(Boolean).join('; ');
		
		throw error(404, `Book not found. ${errorDetails || 'All data sources unavailable.'}`);
	}

	// === STEP 3: Merge Data (Waterfall Prioritization) ===
	const googleVolumeInfo = google?.items?.[0]?.volumeInfo || null;
	const mergedData: MergedBookData = processAndRenderMergedData(
		googleVolumeInfo,
		openlibrary as any,
		loc
	);

	// Add metadata
	const responseData = {
		...mergedData,
		meta: {
			isbn,
			sources: {
				google: !!google,
				openlibrary: !!openlibrary,
				loc: !!loc
			},
			fetchDuration,
			totalDuration: Math.round(performance.now() - startTime),
			timestamp: new Date().toISOString()
		}
	};

	// === STEP 4: Background Writes (waitUntil Pattern) ===
	// CRITICAL: Do NOT await these - use waitUntil to prevent data loss
	if (platform?.context?.waitUntil) {
		// Background Task 1: Insert into D1 database
		const dbWritePromise = (async () => {
			try {
				if (!platform.env?.DB) {
					console.warn('⚠️ D1 database not available');
					return;
				}

				await platform.env.DB.prepare(
					`INSERT INTO scans (isbn, title, json_data, created_at) 
					 VALUES (?, ?, ?, datetime('now'))`
				)
					.bind(
						isbn,
						mergedData.title,
						JSON.stringify(responseData)
					)
					.run();

				console.info(`✅ [DB Write] ${isbn} saved to D1`);
			} catch (dbError) {
				console.error('❌ [DB Write Error]:', dbError);
				// Don't throw - this is a background task
			}
		})();

		// Background Task 2: Write to KV cache
		const kvWritePromise = (async () => {
			try {
				if (!platform.env?.BOOK_CACHE) {
					console.warn('⚠️ KV namespace not available');
					return;
				}

				await platform.env.BOOK_CACHE.put(
					`book:${isbn}`,
					JSON.stringify(responseData),
					{
						expirationTtl: 86400 // 24 hours
					}
				);

				console.info(`✅ [KV Write] ${isbn} cached`);
			} catch (kvError) {
				console.error('❌ [KV Write Error]:', kvError);
				// Don't throw - this is a background task
			}
		})();

		// Schedule background writes to complete after response is sent
		platform.context.waitUntil(Promise.allSettled([dbWritePromise, kvWritePromise]));
	} else {
		console.warn('⚠️ waitUntil not available - background writes will be skipped');
	}

	// === STEP 5: Return Response Immediately ===
	const totalDuration = Math.round(performance.now() - startTime);
	console.info(`🚀 [Response] ${isbn} - ${totalDuration}ms (cache miss)`);

	return json(responseData, {
		headers: {
			'Cache-Control': 'public, max-age=86400',
			'X-Cache': 'MISS',
			'X-Response-Time': `${totalDuration}ms`,
			'X-Sources': JSON.stringify({
				google: !!google,
				openlibrary: !!openlibrary,
				loc: !!loc
			})
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
