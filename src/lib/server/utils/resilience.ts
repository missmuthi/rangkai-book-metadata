import type { KVNamespace } from "$lib/server/types";

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

// In-memory fallback for Circuit Breaker state since KV is removed
const CIRCUIT_BREAKER_STATE = new Map<
  string,
  { failures: number; openUntil?: number }
>();

/**
 * Circuit Breaker
 * Manages the health of an external service.
 *
 * Update: Uses In-Memory Map instead of KV for Free Tier optimization.
 * Note: State is now local to the worker instance and not shared globally,
 * which is acceptable for resilience logic.
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
    // In-Memory Implementation
    const state = CIRCUIT_BREAKER_STATE.get(this.key);

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
  }

  /**
   * Record a success - resets the failure count
   */
  async success(): Promise<void> {
    CIRCUIT_BREAKER_STATE.delete(this.key);
  }

  /**
   * Record a failure - increments count and may open circuit
   */
  async failure(): Promise<void> {
    const state = CIRCUIT_BREAKER_STATE.get(this.key) || { failures: 0 };
    state.failures += 1;

    if (state.failures >= this.config.failureThreshold) {
      state.openUntil = Date.now() + this.config.resetTimeoutSec * 1000;
    }

    CIRCUIT_BREAKER_STATE.set(this.key, state);
  }

  /**
   * Manually open the circuit
   */
  async open(): Promise<void> {
    const state = {
      failures: this.config.failureThreshold,
      openUntil: Date.now() + this.config.resetTimeoutSec * 1000,
    };
    CIRCUIT_BREAKER_STATE.set(this.key, state);
  }
}
