import { createGoogleAuth } from "$lib/auth-simple";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Generate PKCE code verifier (base64url, 43-128 chars)
 * Uses cryptographically secure random bytes
 */
function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Determine if cookies should be secure based on environment
 * - Production (Cloudflare): Always use secure cookies (HTTPS)
 * - Development (localhost): Use non-secure cookies (HTTP)
 */
function isSecureContext(url: URL): boolean {
  // Cloudflare Pages always serves over HTTPS
  if (url.hostname.includes("pages.dev")) return true;
  // Custom domains should use HTTPS
  if (url.protocol === "https:") return true;
  // Localhost development uses HTTP
  return false;
}

/**
 * GET /api/auth/google - Initiate Google OAuth flow
 *
 * This endpoint:
 * 1. Generates PKCE state and code verifier
 * 2. Stores them in secure cookies
 * 3. Redirects user to Google's authorization page
 */
export const GET: RequestHandler = async ({ platform, cookies, url }) => {
  if (!platform?.env) {
    console.error("❌ [OAuth] Platform environment not available");
    return new Response("Platform not configured", { status: 500 });
  }

  try {
    // Enable debug mode for troubleshooting (check URL param or env)
    const debug = url.searchParams.get("debug") === "true";
    const google = createGoogleAuth(platform.env, { debug });

    const state = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();

    // Arctic Google.createAuthorizationURL(state, codeVerifier, scopes[])
    const authUrl = await google.createAuthorizationURL(
      state,
      codeVerifier,
      ["openid", "profile", "email"], // Google scopes as array
    );

    // Log for debugging (redact sensitive info)
    if (debug) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔐 [OAuth] Initiating Google login flow");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("State:", state.substring(0, 8) + "...");
      console.log("Authorization URL hostname:", authUrl.hostname);
      console.log("Secure cookies:", isSecureContext(url));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    // Cookie options with environment-aware security
    const secureCookie = isSecureContext(url);
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax" as const,
      maxAge: 60 * 10, // 10 minutes
    };

    // Store state and code verifier for verification in callback
    cookies.set("google_oauth_state", state, cookieOptions);
    cookies.set("google_code_verifier", codeVerifier, cookieOptions);
    // Store timestamp to prevent replay attacks
    cookies.set("google_oauth_timestamp", Date.now().toString(), cookieOptions);

    throw redirect(302, authUrl.toString());
  } catch (error) {
    // Re-throw redirects (they're not actually errors)
    if (error instanceof Response || (error as { status?: number })?.status === 302) {
      throw error;
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🔴 [OAuth] Failed to initiate login");
    console.error("Error:", error instanceof Error ? error.message : error);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Redirect to login with error
    throw redirect(302, "/login?error=oauth_init_failed");
  }
};
