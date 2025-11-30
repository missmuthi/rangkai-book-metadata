/**
 * Structured logging for Cloudflare Workers
 *
 * Provides a consistent logging format for production debugging while:
 * - Avoiding sensitive data exposure (tokens, passwords)
 * - Adding contextual metadata (userId, requestId, event type)
 * - Maintaining readability in Cloudflare logs
 *
 * Usage:
 * ```ts
 * import { logger } from '$lib/server/log';
 *
 * logger.info('scan_created', { userId, isbn, provider: 'google' });
 * logger.error('metadata_fetch_failed', { isbn, provider: 'openlibrary', error: err.message });
 * logger.warn('cache_miss', { key: 'book:123' });
 * ```
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  [key: string]: unknown;
};

/**
 * Sanitize log context to prevent leaking sensitive data
 */
function sanitizeContext(context: LogContext): LogContext {
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "api_key",
    "apiKey",
    "authorization",
  ];
  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeContext(value as LogContext);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Format log message with timestamp and context
 */
function formatLog(
  level: LogLevel,
  event: string,
  context?: LogContext,
): string {
  const timestamp = new Date().toISOString();
  const sanitized = context ? sanitizeContext(context) : {};

  return JSON.stringify({
    timestamp,
    level: level.toUpperCase(),
    event,
    ...sanitized,
  });
}

/**
 * Structured logger instance
 */
export const logger = {
  /**
   * Debug-level logs (development only, filtered in production)
   */
  debug(event: string, context?: LogContext) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(formatLog("debug", event, context));
    }
  },

  /**
   * Info-level logs (normal operations)
   */
  info(event: string, context?: LogContext) {
    // eslint-disable-next-line no-console
    console.log(formatLog("info", event, context));
  },

  /**
   * Warning-level logs (degraded but recoverable)
   */
  warn(event: string, context?: LogContext) {
    console.warn(formatLog("warn", event, context));
  },

  /**
   * Error-level logs (failures requiring attention)
   */
  error(event: string, context?: LogContext) {
    console.error(formatLog("error", event, context));
  },
};

/**
 * Generate a request correlation ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Common log events (for consistency)
 */
export const LogEvents = {
  // Auth events
  AUTH_SESSION_FETCH_FAILED: "auth_session_fetch_failed",
  AUTH_UNAUTHORIZED: "auth_unauthorized",
  AUTH_OWNERSHIP_DENIED: "auth_ownership_denied",

  // Scan events
  SCAN_CREATED: "scan_created",
  SCAN_BATCH_CREATED: "scan_batch_created",
  SCAN_FETCH_FAILED: "scan_fetch_failed",

  // Metadata events
  METADATA_FETCH_SUCCESS: "metadata_fetch_success",
  METADATA_FETCH_FAILED: "metadata_fetch_failed",
  METADATA_SOURCE_DEGRADED: "metadata_source_degraded",
  METADATA_CACHE_HIT: "metadata_cache_hit",
  METADATA_CACHE_MISS: "metadata_cache_miss",

  // Database events
  DB_QUERY_FAILED: "db_query_failed",
  DB_WRITE_FAILED: "db_write_failed",

  // Cache events
  CACHE_SET_FAILED: "cache_set_failed",
  CACHE_GET_FAILED: "cache_get_failed",
} as const;
