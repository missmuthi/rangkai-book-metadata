import { createGoogleAuth } from "$lib/auth-simple";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Generate PKCE code verifier (base64url, 43-128 chars)
 */
function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * GET /api/auth/google - Initiate Google OAuth flow
 */
export const GET: RequestHandler = async ({ platform, cookies }) => {
  if (!platform?.env) {
    return new Response("Platform not configured", { status: 500 });
  }

  const google = createGoogleAuth(platform.env);
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();

  console.log("[OAuth] Initiating Google login flow");
  console.log("[OAuth] State:", state);

  // Arctic Google.createAuthorizationURL(state, codeVerifier, scopes[])
  const authUrl = await google.createAuthorizationURL(
    state,
    codeVerifier,
    ["openid", "profile", "email"], // Google scopes as array
  );

  console.log("[OAuth] Authorization URL:", authUrl.toString());

  // Store state and code verifier for verification
  cookies.set("google_oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  cookies.set("google_code_verifier", codeVerifier, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  // Store timestamp to prevent replay attacks
  cookies.set("google_oauth_timestamp", Date.now().toString(), {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  throw redirect(302, authUrl.toString());
};
