import { deleteSession } from "$lib/auth-simple";
import type { RequestHandler } from "./$types";
import { logger } from "$lib/server/logger";

/**
 * Determine if cookies should be secure based on environment
 */
function isSecureContext(url: URL): boolean {
  if (url.hostname.includes("pages.dev")) return true;
  if (url.protocol === "https:") return true;
  return false;
}

/**
 * POST /api/auth/sign-out - Sign out
 *
 * Deletes the session from D1 database and clears the session cookie.
 */
export const POST: RequestHandler = async ({ platform, cookies, url, request }) => {
  // CSRF Protection: Ensure Origin matches (if present)
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) {
    logger.warn("sign_out_csrf_blocked", {
      expected: url.origin,
      received: origin,
    });
    return new Response("Cross-site request blocked", { status: 403 });
  }

  if (!platform?.env?.DB) {
    return new Response("Database not configured", { status: 500 });
  }

  const sessionToken = cookies.get("session");
  if (sessionToken) {
    try {
      await deleteSession(platform.env.DB, sessionToken);
      logger.info("sign_out_success", { sessionToken: sessionToken.substring(0, 8) + "..." });
    } catch (error) {
      logger.error("sign_out_failed", { error: error instanceof Error ? error.message : error });
    }
  }

  // Delete session cookie (match exact attributes from creation)
  const secureCookie = isSecureContext(url);
  cookies.delete("session", {
    path: "/",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "strict",
  });

  // console.log("[Sign Out] ✅ Session cookie deleted");

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
};
