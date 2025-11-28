import { deleteSession } from "$lib/auth-simple";
import type { RequestHandler } from "./$types";

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
export const POST: RequestHandler = async ({ platform, cookies, url }) => {
  if (!platform?.env?.DB) {
    return new Response("Database not configured", { status: 500 });
  }

  const sessionToken = cookies.get("session");
  if (sessionToken) {
    try {
      await deleteSession(platform.env.DB, sessionToken);
      // console.log(
      //   "[Sign Out] ✅ Session deleted from database:",
      //   sessionToken.substring(0, 8) + "...",
      // );
    } catch (error) {
      console.error(
        "[Sign Out] ❌ Failed to delete session from database:",
        error,
      );
    }
  }

  // Delete session cookie (match exact attributes from creation)
  const secureCookie = isSecureContext(url);
  cookies.delete("session", {
    path: "/",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
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
