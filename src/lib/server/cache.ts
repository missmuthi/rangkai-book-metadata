/**
 * KV Cache operations layer
 *
 * Single source of truth for Cloudflare KV operations.
 * Provides consistent key naming and TTL management.
 */

import type { KVNamespace } from "./types";

/**
 * Get KV namespace from platform context
 * Returns null if KV is not available (graceful degradation)
 */
export function getKV(platform: App.Platform | undefined): KVNamespace | null {
  return platform?.env?.BOOK_CACHE || null;
}

/**
 * Key naming conventions
 */
export const CacheKeys = {
  book: (isbn: string) => `book:${isbn}`,
  bookMetadata: (isbn: string) => `metadata:${isbn}`,
  userSession: (token: string) => `session:${token}`,
  apiRateLimit: (source: string) => `ratelimit:${source}`,
} as const;

/**
 * Default TTL values (in seconds)
 */
export const CacheTTL = {
  book: 24 * 60 * 60, // 24 hours
  metadata: 7 * 24 * 60 * 60, // 7 days
  session: 7 * 24 * 60 * 60, // 7 days
  rateLimit: 60, // 1 minute
} as const;

// ============================================================================
// GENERIC KV OPERATIONS
// ============================================================================

/**
 * Get a value from KV cache
 *
 * @param kv - KV namespace
 * @param key - Cache key
 * @returns Cached value or null if not found
 */
export async function cacheGet<T = unknown>(
  kv: KVNamespace | null,
  key: string,
): Promise<T | null> {
  if (!kv) return null;

  try {
    const value = await kv.get(key, "json");
    return value as T | null;
  } catch (error) {
    console.error(`[Cache] Failed to get key "${key}":`, error);
    return null;
  }
}

/**
 * Set a value in KV cache
 *
 * @param kv - KV namespace
 * @param key - Cache key
 * @param value - Value to cache (will be JSON serialized)
 * @param ttl - Time to live in seconds (optional)
 */
export async function cacheSet(
  kv: KVNamespace | null,
  key: string,
  value: unknown,
  ttl?: number,
): Promise<void> {
  if (!kv) return;

  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error(`[Cache] Failed to set key "${key}":`, error);
    // Don't throw - cache failures should be non-fatal
  }
}

/**
 * Delete a value from KV cache
 *
 * @param kv - KV namespace
 * @param key - Cache key
 */
export async function cacheDelete(
  kv: KVNamespace | null,
  key: string,
): Promise<void> {
  if (!kv) return;

  try {
    await kv.delete(key);
  } catch (error) {
    console.error(`[Cache] Failed to delete key "${key}":`, error);
  }
}

/**
 * Check if a key exists in KV cache
 *
 * @param kv - KV namespace
 * @param key - Cache key
 * @returns true if key exists, false otherwise
 */
export async function cacheHas(
  kv: KVNamespace | null,
  key: string,
): Promise<boolean> {
  if (!kv) return false;

  try {
    const value = await kv.get(key);
    return value !== null;
  } catch (error) {
    console.error(`[Cache] Failed to check key "${key}":`, error);
    return false;
  }
}

// ============================================================================
// BOOK METADATA CACHE OPERATIONS
// ============================================================================

/**
 * Get book metadata from cache
 */
export async function getBookCache<T = unknown>(
  kv: KVNamespace | null,
  isbn: string,
): Promise<T | null> {
  return cacheGet<T>(kv, CacheKeys.book(isbn));
}

/**
 * Set book metadata in cache
 */
export async function setBookCache(
  kv: KVNamespace | null,
  isbn: string,
  data: unknown,
  ttl: number = CacheTTL.book,
): Promise<void> {
  return cacheSet(kv, CacheKeys.book(isbn), data, ttl);
}

/**
 * Delete book metadata from cache
 */
export async function deleteBookCache(
  kv: KVNamespace | null,
  isbn: string,
): Promise<void> {
  return cacheDelete(kv, CacheKeys.book(isbn));
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Check if an API source is rate limited
 *
 * @param kv - KV namespace
 * @param source - API source identifier (e.g., 'google', 'openlibrary')
 * @returns true if rate limited, false otherwise
 */
export async function isRateLimited(
  kv: KVNamespace | null,
  source: string,
): Promise<boolean> {
  if (!kv) return false;

  const key = CacheKeys.apiRateLimit(source);
  const value = await cacheGet<{ count: number }>(kv, key);

  // Simple rate limit: max 100 requests per minute
  return (value?.count || 0) > 100;
}

/**
 * Increment rate limit counter for an API source
 */
export async function incrementRateLimit(
  kv: KVNamespace | null,
  source: string,
): Promise<void> {
  if (!kv) return;

  const key = CacheKeys.apiRateLimit(source);
  const current = await cacheGet<{ count: number }>(kv, key);
  const newCount = (current?.count || 0) + 1;

  await cacheSet(kv, key, { count: newCount }, CacheTTL.rateLimit);
}

// ============================================================================
// CACHE WARMING / INVALIDATION
// ============================================================================

/**
 * Invalidate all book caches (use with caution)
 */
export async function invalidateAllBookCaches(
  kv: KVNamespace | null,
): Promise<void> {
  if (!kv) return;

  // Note: KV doesn't support wildcard deletes, so we'd need to track keys
  // This is a placeholder for future implementation
  console.warn("[Cache] Bulk invalidation not implemented for KV");
}

/**
 * Get cache statistics (approximate)
 */
export async function getCacheStats(_kv: KVNamespace | null) {
  // KV doesn't provide built-in stats
  // This is a placeholder for custom tracking
  return {
    supported: false,
    message: "KV does not provide native statistics",
  };
}
