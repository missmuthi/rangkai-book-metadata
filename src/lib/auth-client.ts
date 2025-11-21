/**
 * Better Auth Client Configuration
 * For use in SvelteKit components (browser-side)
 */

import { createAuthClient } from 'better-auth/client';

/**
 * Initialize Better Auth client
 * This runs in the browser and communicates with the auth API
 */
export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' 
		? window.location.origin 
		: 'http://localhost:5173'
});

/**
 * Convenience exports for common auth operations
 */
export const {
	signIn,
	signOut,
	signUp,
	useSession,
	getSession,
	updateUser
} = authClient;

/**
 * Sign in with Google OAuth
 * Redirects to Google's OAuth consent screen
 */
export async function signInWithGoogle() {
	return authClient.signIn.social({
		provider: 'google',
		callbackURL: '/dashboard' // Redirect after successful login
	});
}

/**
 * Sign out and redirect to home page
 */
export async function handleSignOut() {
	await authClient.signOut();
	window.location.href = '/';
}

/**
 * Get current session (client-side)
 * Returns null if not authenticated
 */
export async function getCurrentSession() {
	try {
		const session = await authClient.getSession();
		return session;
	} catch (error) {
		console.error('Failed to get session:', error);
		return null;
	}
}
