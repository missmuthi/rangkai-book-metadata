import {
  createGoogleAuth,
  generateSessionToken,
  createSession,
  upsertUser,
} from "$lib/auth-simple";
import { redirect, isRedirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * OAuth Error Types for user-friendly error messages
 */
type OAuthErrorCode =
  | "missing_code"
  | "invalid_state"
  | "missing_verifier"
  | "state_expired"
  | "token_exchange_failed"
  | "user_info_failed"
  | "session_failed"
  | "unknown";

/**
 * Map OAuth error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  missing_code: "Google did not return an authorization code",
  invalid_state: "Security validation failed (state mismatch)",
  missing_verifier: "Session expired or cookies blocked",
  state_expired: "Login session expired. Please try again",
  token_exchange_failed: "Failed to verify with Google",
  user_info_failed: "Could not retrieve your Google profile",
  session_failed: "Could not create your session",
  unknown: "An unexpected error occurred",
};

/**
 * Determine if cookies should be secure based on environment
 */
function isSecureContext(url: URL): boolean {
  if (url.hostname.includes("pages.dev")) return true;
  if (url.protocol === "https:") return true;
  return false;
}

/**
 * Redirect to login with an error message (never returns)
 */
function redirectWithError(code: OAuthErrorCode, details?: string): never {
  console.warn(`⚠️ [OAuth Callback] Error: ${code}`, details || "");
  const errorParam = encodeURIComponent(ERROR_MESSAGES[code]);
  throw redirect(302, `/login?error=${errorParam}`);
}

/**
 * GET /api/auth/callback/google - Handle Google OAuth callback
 *
 * This endpoint:
 * 1. Validates the OAuth state parameter (CSRF protection)
 * 2. Exchanges the authorization code for tokens
 * 3. Fetches user info from Google
 * 4. Creates or updates the user in D1
 * 5. Creates a session and sets the session cookie
 * 6. Redirects to the home page
 */
export const GET: RequestHandler = async ({
  url,
  platform,
  cookies,
  request,
}): Promise<Response> => {
  if (!platform?.env) {
    console.error("❌ [OAuth Callback] Platform not configured");
    return new Response("Platform not configured", { status: 500 });
  }

  // Extract OAuth parameters from callback URL
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Check if Google returned an error (e.g., user denied consent)
  if (errorParam) {
    console.warn("⚠️ [OAuth Callback] Google returned error:", errorParam);
    const errorDesc = url.searchParams.get("error_description") || errorParam;
    throw redirect(302, `/login?error=${encodeURIComponent(errorDesc)}`);
  }

  // Retrieve stored OAuth state from cookies
  const storedState = cookies.get("google_oauth_state");
  const codeVerifier = cookies.get("google_code_verifier");
  const timestamp = cookies.get("google_oauth_timestamp");

  // Debug logging (only in callback to avoid sensitive data exposure)
  const debug = url.searchParams.get("debug") === "true";
  if (debug) {
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn("🔐 [OAuth Callback] Processing callback");
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn("Has code:", !!code);
    console.warn("Has state:", !!state);
    console.warn("Has stored state:", !!storedState);
    console.warn("Has code verifier:", !!codeVerifier);
    console.warn("State matches:", state === storedState);
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  // Validate state freshness (prevent replay attacks)
  if (timestamp) {
    const elapsed = Date.now() - parseInt(timestamp);
    if (elapsed > 600000) {
      // 10 minutes
      console.warn("⚠️ [OAuth Callback] State expired, elapsed:", elapsed, "ms");
      redirectWithError("state_expired");
    }
  }

  // Validate OAuth callback parameters
  if (!code) {
    redirectWithError("missing_code", `URL: ${url.pathname}`);
  }

  if (!state || state !== storedState) {
    redirectWithError(
      "invalid_state",
      `Expected: ${storedState?.substring(0, 8)}..., Got: ${state?.substring(0, 8)}...`,
    );
  }

  if (!codeVerifier) {
    redirectWithError(
      "missing_verifier",
      "Cookie may have been blocked or expired",
    );
  }

  // Cookie options for this context
  const secureCookie = isSecureContext(url);

  try {
    const google = createGoogleAuth(platform.env);

    // Exchange authorization code for tokens
    let tokens;
    try {
      tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch (tokenError) {
      console.error("❌ [OAuth Callback] Token exchange failed:", tokenError);
      redirectWithError(
        "token_exchange_failed",
        tokenError instanceof Error ? tokenError.message : "Unknown error",
      );
    }

    // Fetch user info from Google
    let googleUser: { email: string; name: string; picture: string };
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.accessToken()}` },
        },
      );

      if (!response.ok) {
        throw new Error(`Google API returned ${response.status}`);
      }

      googleUser = (await response.json()) as {
        email: string;
        name: string;
        picture: string;
      };
    } catch (userInfoError) {
      console.error("❌ [OAuth Callback] User info fetch failed:", userInfoError);
      redirectWithError(
        "user_info_failed",
        userInfoError instanceof Error ? userInfoError.message : "Unknown error",
      );
    }

    // Create or update user in database
    let userId: string;
    try {
      userId = await upsertUser(
        platform.env.DB,
        googleUser.email,
        googleUser.name,
        googleUser.picture,
      );
    } catch (dbError) {
      console.error("❌ [OAuth Callback] User upsert failed:", dbError);
      redirectWithError(
        "session_failed",
        dbError instanceof Error ? dbError.message : "Database error",
      );
    }

    // Create session with user agent tracking
    try {
      const sessionToken = generateSessionToken();
      const userAgent = request.headers.get("user-agent") || "Unknown";
      await createSession(platform.env.DB, userId, sessionToken, userAgent);

      // Set session cookie
      cookies.set("session", sessionToken, {
        path: "/",
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    } catch (sessionError) {
      console.error("❌ [OAuth Callback] Session creation failed:", sessionError);
      redirectWithError(
        "session_failed",
        sessionError instanceof Error ? sessionError.message : "Session error",
      );
    }

    // Clear OAuth state cookies (cleanup)
    const deleteCookieOptions = { path: "/" };
    cookies.delete("google_oauth_state", deleteCookieOptions);
    cookies.delete("google_code_verifier", deleteCookieOptions);
    cookies.delete("google_oauth_timestamp", deleteCookieOptions);

    console.warn("✅ [OAuth Callback] Login successful for:", googleUser.email);

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

    // Redirect to login with generic error instead of showing 500 page
    throw redirect(302, `/login?error=${encodeURIComponent(ERROR_MESSAGES.unknown)}`);
  }
};
