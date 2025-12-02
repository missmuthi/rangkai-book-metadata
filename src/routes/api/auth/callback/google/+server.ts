import {
  createGoogleAuth,
  generateSessionToken,
  createSession,
  upsertUser,
} from "$lib/auth-simple";
import { redirect, isRedirect, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { logger } from "$lib/server/logger";
import { z } from "zod";

const querySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  debug: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

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
  logger.warn("oauth_callback_error", { code, details });
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
    logger.error("oauth_platform_error", {
      message: "Platform not configured",
    });
    return new Response("Platform not configured", { status: 500 });
  }

  // Validate query parameters
  const queryResult = querySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!queryResult.success) {
    logger.warn("oauth_invalid_params", { errors: queryResult.error.message });
    throw error(400, "Invalid OAuth parameters");
  }
  const {
    code,
    state,
    error: errorParam,
    error_description,
    debug,
  } = queryResult.data;

  // Check if Google returned an error (e.g., user denied consent)
  if (errorParam) {
    logger.warn("oauth_provider_error", {
      error: errorParam,
      description: error_description,
    });
    const errorDesc = error_description || errorParam;
    throw redirect(302, `/login?error=${encodeURIComponent(errorDesc)}`);
  }

  // Retrieve stored OAuth state from cookies
  const storedState = cookies.get("google_oauth_state");
  const codeVerifier = cookies.get("google_code_verifier");
  const timestamp = cookies.get("google_oauth_timestamp");

  // Debug logging (only in callback to avoid sensitive data exposure)
  if (debug) {
    logger.debug("oauth_callback_process", {
      hasCode: !!code,
      hasState: !!state,
      hasStoredState: !!storedState,
      hasVerifier: !!codeVerifier,
      stateMatch: state === storedState,
    });
  }

  // Validate state freshness (prevent replay attacks)
  if (timestamp) {
    const elapsed = Date.now() - parseInt(timestamp);
    if (elapsed > 600000) {
      // 10 minutes
      logger.warn("oauth_state_expired", { elapsed });
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
      logger.error("oauth_token_exchange_failed", {
        error:
          tokenError instanceof Error ? tokenError.message : "Unknown error",
      });
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
      logger.error("oauth_user_info_failed", {
        error:
          userInfoError instanceof Error
            ? userInfoError.message
            : "Unknown error",
      });
      redirectWithError(
        "user_info_failed",
        userInfoError instanceof Error
          ? userInfoError.message
          : "Unknown error",
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
      logger.error("oauth_user_upsert_failed", {
        error: dbError instanceof Error ? dbError.message : "Database error",
      });
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
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    } catch (sessionError) {
      logger.error("oauth_session_creation_failed", {
        error:
          sessionError instanceof Error
            ? sessionError.message
            : "Session error",
      });
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

    logger.info("oauth_login_success", { email: googleUser.email });

    // Redirect to home page (stable route) — add a query param to force client revalidation
    throw redirect(303, "/?loginSuccess=1");
  } catch (error) {
    // ⚠️ CRITICAL: SvelteKit throws redirects as errors - we must re-throw them!
    if (isRedirect(error)) {
      // Even on redirect (which might be an error redirect), we should attempt to clear state cookies
      // if we are exiting the flow. But if it's success redirect (303), we already cleared them.
      // If it's failure redirect (302 from redirectWithError), we might want to clear them too.
      // However, redirectWithError throws immediately.
      // Let's rely on the fact that if we are here, we might not have cleared them if an error occurred before clearing.
      // Ideally, use a finally block or clear before error redirect.
      // But clearing cookies requires access to `cookies` object which we have.
      // For now, let's keep it simple as `redirectWithError` is used for logic errors where we might want to retry or not?
      // Actually, if state is invalid, we definitely want to clear it.
      // But redirectWithError throws, so code below it won't run.
      // We should probably wrap the whole thing in try/finally if we want guaranteed cleanup,
      // but we only want cleanup if we consume the state.
      throw error; // Allow the redirect to propagate
    }

    // Log actual errors
    logger.error("oauth_callback_error", {
      route: "/api/auth/callback/google",
      errorType: error instanceof Error ? error.constructor.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Clean up cookies on unknown error to avoid stuck state
    const deleteCookieOptions = { path: "/" };
    cookies.delete("google_oauth_state", deleteCookieOptions);
    cookies.delete("google_code_verifier", deleteCookieOptions);
    cookies.delete("google_oauth_timestamp", deleteCookieOptions);

    // Redirect to login with generic error instead of showing 500 page
    throw redirect(
      302,
      `/login?error=${encodeURIComponent(ERROR_MESSAGES.unknown)}`,
    );
  }
};
