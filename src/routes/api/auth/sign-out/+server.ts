import { deleteSession } from "$lib/auth-simple";
import type { RequestHandler } from "./$types";

/**
 * POST /api/auth/sign-out - Sign out
 */
export const POST: RequestHandler = async ({ platform, cookies }) => {
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
  cookies.delete("session", {
    path: "/",
    httpOnly: true,
    secure: true,
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
