import {
  createGoogleAuth,
  generateSessionToken,
  createSession,
  upsertUser,
} from "$lib/auth-simple";
import { redirect, isRedirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/auth/callback/google - Handle Google OAuth callback
 */
export const GET: RequestHandler = async ({
  url,
  platform,
  cookies,
  request,
}) => {
  if (!platform?.env) {
    return new Response("Platform not configured", { status: 500 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies.get("google_oauth_state");
  const codeVerifier = cookies.get("google_code_verifier");
  const timestamp = cookies.get("google_oauth_timestamp");

  // Validate state freshness (prevent replay attacks)
  if (timestamp) {
    const elapsed = Date.now() - parseInt(timestamp);
    if (elapsed > 600000) {
      // 10 minutes
      console.warn("[OAuth] State expired, elapsed:", elapsed, "ms");
      return new Response("OAuth state expired", { status: 400 });
    }
  }

  if (!code || !state || state !== storedState || !codeVerifier) {
    return new Response("Invalid OAuth callback", { status: 400 });
  }

  try {
    const google = createGoogleAuth(platform.env);
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);

    // Fetch user info from Google
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      },
    );

    const googleUser = (await response.json()) as {
      email: string;
      name: string;
      picture: string;
    };

    // Create or update user
    const userId = await upsertUser(
      platform.env.DB,
      googleUser.email,
      googleUser.name,
      googleUser.picture,
    );

    // Create session with user agent tracking
    const sessionToken = generateSessionToken();
    const userAgent = request.headers.get("user-agent") || "Unknown";
    await createSession(platform.env.DB, userId, sessionToken, userAgent);

    // Set session cookie
    cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Clear OAuth state, code verifier, and timestamp
    cookies.delete("google_oauth_state", { path: "/" });
    cookies.delete("google_code_verifier", { path: "/" });
    cookies.delete("google_oauth_timestamp", { path: "/" });

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[OAuth] ✅ Login successful for user:", googleUser.email);
    }

    // Redirect to home page (stable route)
    throw redirect(303, "/");
  } catch (error) {
    // ⚠️ CRITICAL: SvelteKit throws redirects as errors - we must re-throw them!
    if (isRedirect(error)) {
      throw error; // Allow the redirect to propagate
    }

    // Log actual errors
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🔴 OAUTH CALLBACK ERROR");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Route: /api/auth/callback/google");

    if (error instanceof Error) {
      console.error("Error Type:", error.constructor.name);
      console.error("Error Message:", error.message);
      console.error("Stack Trace:", error.stack);
    } else {
      console.error("Unknown Error:", error);
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return new Response("Authentication failed", { status: 500 });
  }
};
