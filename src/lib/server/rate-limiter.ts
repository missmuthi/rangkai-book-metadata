import type { KVNamespace } from "$lib/server/types";
import { logger } from "$lib/server/logger";

/**
 * Rate Limiter using Token Bucket / Sliding Window (simplified)
 *
 * Uses Cloudflare KV to store request counts.
 *
 * Key format: `ratelimit:<ip>:<window_timestamp>`
 */
export class RateLimiter {
  constructor(
    private kv: KVNamespace | null,
    private limit: number = 60, // requests
    private window: number = 60, // seconds
  ) {}

  /**
   * Check if the request is allowed
   * @param identifier Unique identifier for the client (e.g., IP address, User ID)
   * @returns true if allowed, false if limited
   */
  async check(identifier: string): Promise<boolean> {
    if (!this.kv) return true; // Fail open if KV is missing

    const now = Math.floor(Date.now() / 1000);
    const windowKey = Math.floor(now / this.window);
    const key = `ratelimit:${identifier}:${windowKey}`;

    try {
      const countStr = await this.kv.get(key);
      const count = countStr ? parseInt(countStr, 10) : 0;

      if (count >= this.limit) {
        return false;
      }

      // Increment count
      // Note: This is not atomic without durable objects, but good enough for KV rate limiting
      await this.kv.put(key, (count + 1).toString(), {
        expirationTtl: this.window * 2, // Keep a bit longer for debugging
      });

      return true;
    } catch (error) {
      logger.error("ratelimiter_check_error", { identifier, error });
      return true; // Fail open on error
    }
  }

  /**
   * Get remaining requests (approximate)
   */
  async getRemaining(identifier: string): Promise<number> {
    if (!this.kv) return this.limit;

    const now = Math.floor(Date.now() / 1000);
    const windowKey = Math.floor(now / this.window);
    const key = `ratelimit:${identifier}:${windowKey}`;

    try {
      const countStr = await this.kv.get(key);
      const count = countStr ? parseInt(countStr, 10) : 0;
      return Math.max(0, this.limit - count);
    } catch {
      return this.limit;
    }
  }
}
