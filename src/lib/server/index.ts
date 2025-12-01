/**
 * Server-side utilities barrel export
 *
 * Centralized exports for all server-side infrastructure:
 * - Authentication helpers
 * - Database operations
 * - Cache operations (Deprecation Warning: KV Removed)
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
  requireOwnership,
} from "./auth";

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
  getUserStats,
  searchUserScansByAuthor,
  searchUserScansBySubject,
  searchUserScansByDDC,
  searchUserScansByLCC,
  searchUserScansGeneral,
} from "./db";

// Cache operations
// Note: KV-specific functions are removed or no-ops
export {
  getKV,
  CacheKeys,
  CacheTTL,
  cacheGet,
  cacheSet,
  cacheDelete,
  // Removed legacy functions not in cache.ts
} from "./cache";

// Metadata engine
export {
  fetchBookByIsbn,
  searchBooksByTitle,
  fetchAllSources,
  getSourceStatus,
} from "./metadata";
export type { MetadataFetchResult } from "./metadata";

// Types
export type {
  User,
  Session,
  Scan,
  SessionData,
  D1Database,
  KVNamespace,
} from "./types";
