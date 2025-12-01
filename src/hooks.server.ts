import type { Handle, HandleServerError } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { RateLimiter } from "$lib/server/rate-limiter";
import { getKV } from "$lib/server/cache";

/**
 * Global error handler for server-side errors
 * Logs complete error details to console for debugging
 */
export const handleError: HandleServerError = ({
  error,
  event,
  status,
  message,
}) => {
  const errorId = crypto.randomUUID();

  // Structured error log via logger
  logger.error("server_error_caught", {
    errorId,
    status,
    message,
    route: event.route?.id || "unknown",
    url: event.url.toString(),
    method: event.request.method,
    timestamp: new Date().toISOString(),
  });

  // Log full error object and stack trace
  if (error instanceof Error) {
    logger.error("server_error_stack", {
      name: error.name,
      message: error.message,
      stack: error.stack || "No stack trace available",
    });

    // Log any additional properties on the error object
    const errorKeys = Object.keys(error).filter(
      (key) => !["name", "message", "stack"].includes(key),
    );
    if (errorKeys.length > 0) {
      const additional: Record<string, unknown> = {};
      errorKeys.forEach((key) => {
        additional[key] = (error as unknown as Record<string, unknown>)[key];
      });
      logger.error("server_error_additional_props", additional);
    }
  } else {
    // Handle non-Error objects
    logger.error("server_error_non_error_object", { error });
  }

  logger.error("server_error_end", { errorId });

  // Return sanitized error to client
  return {
    message: `An error occurred (ID: ${errorId})`,
    errorId,
  };
};

/**
 * Global request handler with lightweight session injection and Rate Limiting
 */
export const handle: Handle = async ({ event, resolve }) => {
  // Debug: Print incoming headers to verify Playwright session flags
  try {
    // Debug log at info for presence of header (fallback when running preview)
    logger.debug("hook_incoming_test_header", {
      header: event.request.headers.get("x-playwright-test-session"),
      cookie: event.request.headers.get("cookie"),
    });
  } catch (e) {
    // ignore
  }
  // === TEST SESSION BYPASS (DEV ONLY) ===
  // Allow e2e tests (Playwright) to set a fake authenticated session via a header
  // or query param so the preview server can serve content without a real DB-backed session.
  // This MUST be restricted to local dev/test only.
  try {
    // Also allow when preview server is started for Playwright with PLAYWRIGHT_PREVIEW=1
    if (import.meta.env.DEV || process.env.PLAYWRIGHT_PREVIEW === "1") {
      const testHeader = event.request.headers.get("x-playwright-test-session");
      const testParam = event.url.searchParams.get("test_session");
      const testCookie = event.cookies.get("test_session");
      if (testHeader === "1" || testParam === "1" || testCookie === "1") {
        // Inject test session and user into locals
        event.locals.session = {
          id: "test-session",
          expires: Date.now() + 3600000,
        } as any;
        event.locals.user = {
          id: "test-user",
          email: "test@example.com",
          name: "Playwright Test",
        } as any;
        logger.debug("test_session_injected", {
          path: event.url.pathname,
          header: testHeader,
          param: testParam,
          cookie: testCookie,
          PLAYWRIGHT_PREVIEW: process.env.PLAYWRIGHT_PREVIEW,
          DEV: import.meta.env.DEV,
        });
        logger.info("test_session_injected", {
          path: event.url.pathname,
          header: testHeader,
          param: testParam,
          cookie: testCookie,
        });
      }
    }
  } catch (e) {
    // Swallow errors to avoid interrupting normal flow
    logger.debug("test_session_injection_failed", { error: e });
  }
  // Log incoming requests in development
  if (import.meta.env.DEV) {
    logger.debug(`incoming_request`, {
      method: event.request.method,
      path: event.url.pathname,
    });
  }

  // === Rate Limiting ===
  // Limit unauthenticated users on API routes
  if (
    event.url.pathname.startsWith("/api/") &&
    !event.url.pathname.startsWith("/api/auth")
  ) {
    const kv = getKV(event.platform);
    // Check for session token to determine authentication status (simple check before full session load)
    const sessionToken = event.cookies.get("session");

    if (!sessionToken) {
      const clientIp = event.getClientAddress();
      // Limit: 60 requests per minute for unauthenticated users
      const limiter = new RateLimiter(kv, 60, 60);
      const allowed = await limiter.check(clientIp);

      if (!allowed) {
        return new Response("Rate limit exceeded", { status: 429 });
      }
    }
  }

  try {
    // Only attempt to get session if we have platform context and DB and it's not already injected
    if (!event.locals.session && event.platform?.env?.DB) {
      const { getSession } = await import("$lib/auth-simple");
      const sessionToken = event.cookies.get("session");

      if (sessionToken) {
        const sessionData = await getSession(
          event.platform.env.DB,
          sessionToken,
        );

        // Inject session and user into event.locals for use in routes and layouts
        if (sessionData) {
          // sessionData already matches SessionData type from lib/server/types.ts
          event.locals.session = sessionData;
          event.locals.user = sessionData.user;
        } else {
          // Session token exists but is invalid/expired
          if (event.url.pathname.startsWith("/api/")) {
            logger.warn("auth_invalid_session_token", {
              path: event.url.pathname,
            });
          }
          event.locals.session = null;
          event.locals.user = null;
        }
      } else {
        // No session token in cookies; only clear locals if not pre-injected by test mode
        if (
          event.url.pathname.startsWith("/api/") &&
          !event.url.pathname.startsWith("/api/auth")
        ) {
          logger.warn("auth_no_session_token", { path: event.url.pathname });
        }
        if (!event.locals.session) {
          event.locals.session = null;
          event.locals.user = null;
        }
      }
    } else {
      // No platform context (local dev without D1)
      if (event.url.pathname.startsWith("/api/")) {
        logger.warn("auth_no_platform_db", { path: event.url.pathname });
      }
      // Keep pre-injected locals.session if present, otherwise set to null
      if (!event.locals.session) {
        event.locals.session = null;
        event.locals.user = null;
      }
    }

    const response = await resolve(event);

    // Security Headers
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
    // Content Security Policy: enforce strict defaults and allow known sources for images/connect
    const CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://books.google.com https://covers.openlibrary.org https://wsrv.nl https://images-na.ssl-images-amazon.com",
      "connect-src 'self' https://*.googleapis.com https://openlibrary.org https://api.loc.gov",
      "font-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ");
    response.headers.set("Content-Security-Policy", CSP);

    return response;
  } catch (error) {
    // Session fetch failed - continue without session
    logger.error("session_fetch_failed", { path: event.url.pathname, error });
    event.locals.session = null;
    event.locals.user = null;

    const response = await resolve(event);
    return response;
  }
};
