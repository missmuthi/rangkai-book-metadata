/**
 * Client-side authentication helpers
 *
 * Provides utilities for initiating login and logout flows from the browser.
 */

/**
 * Initiate Google OAuth login flow
 */
export function signIn() {
  window.location.href = "/api/auth/google";
}

/**
 * Sign out the current user
 * Calls the sign-out API endpoint and reloads the page
 */
export async function signOut() {
  try {
    const response = await fetch("/api/auth/sign-out", { method: "POST" });
    if (response.ok) {
      window.location.href = "/";
    } else {
      console.error("Failed to sign out");
    }
  } catch (error) {
    console.error("Error signing out:", error);
  }
}
