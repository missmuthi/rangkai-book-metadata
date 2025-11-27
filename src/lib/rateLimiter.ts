/**
 * Simple rate limiter utility for API calls
 * Prevents excessive API requests within a time window
 */

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  /**
   * Check if a request is allowed under the rate limit
   * @param key Unique identifier for the rate limit (e.g., 'google-books', 'openlibrary')
   * @param options Rate limiting options
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(key: string, options: RateLimitOptions): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired, allow and reset
      this.limits.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return true;
    }

    if (entry.count >= options.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for a key
   * @param key Unique identifier for the rate limit
   * @param options Rate limiting options
   * @returns number of remaining requests, or -1 if window expired
   */
  getRemainingRequests(key: string, options: RateLimitOptions): number {
    const entry = this.limits.get(key);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return options.maxRequests;
    }

    return Math.max(0, options.maxRequests - entry.count);
  }

  /**
   * Get time until reset for a key (in milliseconds)
   * @param key Unique identifier for the rate limit
   * @returns milliseconds until reset, or 0 if no active limit
   */
  getTimeUntilReset(key: string): number {
    const entry = this.limits.get(key);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return 0;
    }

    return Math.max(0, entry.resetTime - now);
  }

  /**
   * Clear all rate limits (useful for testing)
   */
  clear(): void {
    this.limits.clear();
  }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

// Pre-configured rate limiters for common APIs
export const GOOGLE_BOOKS_LIMIT = {
  maxRequests: 100, // Google's daily limit is much higher, but we throttle for safety
  windowMs: 60 * 1000, // 1 minute window
};

export const OPENLIBRARY_LIMIT = {
  maxRequests: 100, // OpenLibrary has no strict limits, but we throttle for politeness
  windowMs: 60 * 1000, // 1 minute window
};

/**
 * Check if Google Books API request is allowed
 */
export function checkGoogleBooksLimit(): boolean {
  return rateLimiter.isAllowed("google-books", GOOGLE_BOOKS_LIMIT);
}

/**
 * Check if OpenLibrary API request is allowed
 */
export function checkOpenLibraryLimit(): boolean {
  return rateLimiter.isAllowed("openlibrary", OPENLIBRARY_LIMIT);
}

/**
 * Get rate limit status for display
 */
export function getRateLimitStatus() {
  const googleRemaining = rateLimiter.getRemainingRequests(
    "google-books",
    GOOGLE_BOOKS_LIMIT,
  );
  const googleResetMs = rateLimiter.getTimeUntilReset("google-books");
  const openLibraryRemaining = rateLimiter.getRemainingRequests(
    "openlibrary",
    OPENLIBRARY_LIMIT,
  );
  const openLibraryResetMs = rateLimiter.getTimeUntilReset("openlibrary");

  return {
    google: {
      remaining: googleRemaining,
      resetInMs: googleResetMs,
      resetInSeconds: Math.ceil(googleResetMs / 1000),
    },
    openlibrary: {
      remaining: openLibraryRemaining,
      resetInMs: openLibraryResetMs,
      resetInSeconds: Math.ceil(openLibraryResetMs / 1000),
    },
  };
}
