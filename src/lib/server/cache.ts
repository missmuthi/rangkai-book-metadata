/**
 * Caching Utilities
 *
 * NOTE: Cloudflare KV (BOOK_CACHE) usage is DEPRECATED in favor of
 * HTTP Cache (caches.default) + D1 (Source of Truth).
 *
 * This file remains for type compatibility or potential future Redis support.
 */

// import type { KVNamespace } from "./types";
// logger removed: unused in current implementation

/**
 * Standard Cache Keys
 */
export const CacheKeys = {
  book: (isbn: string) => `book:${isbn}`,
  scan: (userId: string, scanId: number) => `scan:${userId}:${scanId}`,
  userHistory: (userId: string) => `history:${userId}`,
};

/**
 * Standard TTLs (in seconds)
 */
export const CacheTTL = {
  book: 86400 * 7, // 7 days (Aggressive)
  scan: 3600, // 1 hour
  userHistory: 300, // 5 minutes
};

/**
 * Helper to get KV namespace safely
 * @deprecated KV is removed. Returns null.
 */
export function getKV(_platform: unknown): unknown | null {
  return null;
}

/**
 * Generic wrapper to get data from KV with error handling
 * @deprecated KV is removed. Always returns null.
 */
export async function cacheGet<T>(
  _kv: unknown,
  _key: string,
): Promise<T | null> {
  return null;
}

/**
 * Generic wrapper to set data to KV with error handling
 * @deprecated KV is removed. No-op.
 */
export async function cacheSet(
  _kv: unknown,
  _key: string,
  _value: unknown,
  _ttl: number,
): Promise<void> {
  return;
}

/**
 * Generic wrapper to delete data from KV
 * @deprecated KV is removed. No-op.
 */
export async function cacheDelete(_kv: unknown, _key: string): Promise<void> {
  return;
}
