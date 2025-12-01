import type { KVNamespace } from "$lib/server/types";
import { logger } from "$lib/server/logger";

/**
 * Timeout Wrapper
 * Wraps a promise with a timeout. If the promise takes longer than the timeout,
 * it rejects with a timeout error.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening the circuit
  resetTimeoutSec: number; // Time in seconds to keep the circuit open
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutSec: 300, // 5 minutes
};

/**
 * Circuit Breaker
 * Manages the health of an external service using KV to store state.
 */
export class CircuitBreaker {
  constructor(
    private kv: KVNamespace | null,
    private serviceName: string,
    private config: CircuitBreakerConfig = DEFAULT_CONFIG,
  ) {}

  private get key(): string {
    return `circuit:${this.serviceName}`;
  }

  /**
   * Check if the circuit is open (service is down)
   */
  async isOpen(): Promise<boolean> {
    if (!this.kv) return false; // If KV is missing, fail open (allow requests) or closed (block)? Standard is allow.

    try {
      const state = await this.kv.get<{ failures: number; openUntil?: number }>(
        this.key,
        "json",
      );

      if (!state) return false;

      // If circuit is explicitly open
      if (state.openUntil && Date.now() < state.openUntil) {
        return true;
      }

      // If failures exceed threshold, open the circuit now (lazy open)
      if (state.failures >= this.config.failureThreshold) {
        await this.open();
        return true;
      }

      return false;
    } catch (error) {
      logger.error("circuitbreaker_check_failed", { serviceName: this.serviceName, error });
      return false; // Fail safe
    }
  }

  /**
   * Record a success - resets the failure count
   */
  async success(): Promise<void> {
    if (!this.kv) return;
    // Only delete/reset if there was a record to save writes, but simplest is to delete
    // Optimization: only delete if it exists?
    // For now, let's just delete the key to reset.
    try {
      await this.kv.delete(this.key);
    } catch (error) {
      logger.error("circuitbreaker_success_failed", { serviceName: this.serviceName, error });
    }
  }

  /**
   * Record a failure - increments count and may open circuit
   */
  async failure(): Promise<void> {
    if (!this.kv) return;

    try {
      const state = (await this.kv.get<{
        failures: number;
        openUntil?: number;
      }>(this.key, "json")) || { failures: 0 };

      state.failures += 1;

      if (state.failures >= this.config.failureThreshold) {
        state.openUntil = Date.now() + this.config.resetTimeoutSec * 1000;
      }

      // Use the reset timeout as TTL if open, or a safe default (e.g. 1 hour) if just counting failures
      const ttl = state.openUntil ? this.config.resetTimeoutSec : 3600;

      await this.kv.put(this.key, JSON.stringify(state), {
        expirationTtl: ttl,
      });
    } catch (error) {
      logger.error("circuitbreaker_failure_failed", { serviceName: this.serviceName, error });
    }
  }

  /**
   * Manually open the circuit
   */
  async open(): Promise<void> {
    if (!this.kv) return;
    try {
      const state = {
        failures: this.config.failureThreshold,
        openUntil: Date.now() + this.config.resetTimeoutSec * 1000,
      };
      await this.kv.put(this.key, JSON.stringify(state), {
        expirationTtl: this.config.resetTimeoutSec,
      });
    } catch (error) {
      logger.error("circuitbreaker_open_failed", { serviceName: this.serviceName, error });
    }
  }
}
