import type { Handle, HandleServerError } from "@sveltejs/kit";
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

  // Log comprehensive error details to server console
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("🔴 SERVER ERROR CAUGHT");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("Error ID:", errorId);
  console.error("Status Code:", status);
  console.error("Message:", message);
  console.error("Route:", event.route?.id || "unknown");
  console.error("URL:", event.url.toString());
  console.error("Method:", event.request.method);
  console.error("Timestamp:", new Date().toISOString());
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Log full error object and stack trace
  if (error instanceof Error) {
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Stack Trace:");
    console.error(error.stack || "No stack trace available");

    // Log any additional properties on the error object
    const errorKeys = Object.keys(error).filter(
      (key) => !["name", "message", "stack"].includes(key),
    );
    if (errorKeys.length > 0) {
      console.error("Additional Error Properties:");
      errorKeys.forEach((key) => {
        console.error(
          `  ${key}:`,
          (error as unknown as Record<string, unknown>)[key],
        );
      });
    }
  } else {
    // Handle non-Error objects
    console.error("Non-Error object thrown:");
    console.error(error);
  }

  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

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
  // Log incoming requests in development
  if (import.meta.env.DEV) {
    console.warn(`[${event.request.method}] ${event.url.pathname}`);
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
    // Only attempt to get session if we have platform context and DB
    if (event.platform?.env?.DB) {
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
            console.warn(
              `[Auth] Invalid/expired session token for ${event.url.pathname}`,
            );
          }
          event.locals.session = null;
          event.locals.user = null;
        }
      } else {
        // No session token in cookies
        if (
          event.url.pathname.startsWith("/api/") &&
          !event.url.pathname.startsWith("/api/auth")
        ) {
          console.warn(
            `[Auth] No session token found for ${event.url.pathname}`,
          );
        }
        event.locals.session = null;
        event.locals.user = null;
      }
    } else {
      // No platform context (local dev without D1)
      if (event.url.pathname.startsWith("/api/")) {
        console.warn(
          `[Auth] No platform.env.DB available for ${event.url.pathname}`,
        );
      }
      event.locals.session = null;
      event.locals.user = null;
    }

    const response = await resolve(event);

    // Security Headers
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

    return response;
  } catch (error) {
    // Session fetch failed - continue without session
    console.error("⚠️ Failed to fetch session:", error);
    console.error("Path:", event.url.pathname);
    event.locals.session = null;
    event.locals.user = null;

    const response = await resolve(event);
    return response;
  }
};
