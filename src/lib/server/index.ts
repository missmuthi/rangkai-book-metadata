/**
 * Server-side utilities barrel export
 * 
 * Centralized exports for all server-side infrastructure:
 * - Authentication helpers
 * - Database operations
 * - Cache operations
 * - Metadata engine
 * - Type definitions
 */

// Auth helpers
export {
	getSession,
	requireSession,
	getUser,
	requireUser,
	canAccessResource,
	requireOwnership
} from './auth';

// Database operations
export {
	getDB,
	findUserByEmail,
	findUserById,
	getUserScans,
	countUserScans,
	getScanById,
	createScan,
	createAnonymousScan,
	updateScanStatus,
	deleteScan,
	getRecentScansGlobal,
	getUserStats
} from './db';

// Cache operations
export {
	getKV,
	CacheKeys,
	CacheTTL,
	cacheGet,
	cacheSet,
	cacheDelete,
	cacheHas,
	getBookCache,
	setBookCache,
	deleteBookCache,
	isRateLimited,
	incrementRateLimit,
	invalidateAllBookCaches,
	getCacheStats
} from './cache';

// Metadata engine
export {
	fetchBookByIsbn,
	searchBooksByTitle,
	fetchAllSources,
	getSourceStatus
} from './metadata';
export type { MetadataFetchResult } from './metadata';

// Types
export type { User, Session, Scan, SessionData, D1Database, KVNamespace } from './types';
