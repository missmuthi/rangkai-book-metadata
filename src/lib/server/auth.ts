/**
 * Server-side authentication helpers
 * 
 * ## Auth Stack Overview
 * 
 * Rangkai uses a **custom authentication system** with the following components:
 * - **Primary mechanism**: Google OAuth via `arctic` library
 * - **Session storage**: D1 database (`session` table)
 * - **Session injection**: `hooks.server.ts` populates `event.locals.session`
 * - **Auth helpers**: This module (`auth.ts`) provides request-scoped utilities
 * 
 * ## Auth Flow
 * 
 * 1. **Login**: User authenticates via Google OAuth
 *    - Handled by `/api/auth/[...all]/+server.ts`
 *    - Creates session token, stores in D1
 *    - Sets `session` cookie
 * 
 * 2. **Request handling** (`hooks.server.ts`):
 *    - Reads `session` cookie
 *    - Queries D1 for session data
 *    - Injects `event.locals.session` and `event.locals.user`
 * 
 * 3. **Route protection** (this module):
 *    - `getSession(event)` - retrieve current session (null if not logged in)
 *    - `requireSession(event)` - enforce authentication (redirect to /login if needed)
 *    - `requireOwnership(event, resourceUserId)` - enforce resource ownership
 * 
 * ## Usage Examples
 * 
 * ```ts
 * // Optional auth (allow both logged-in and guest users)
 * export const load = async (event) => {
 *   const session = await getSession(event);
 *   return {
 *     isLoggedIn: !!session,
 *     user: session?.user
 *   };
 * };
 * 
 * // Required auth (redirect to login if not authenticated)
 * export const load = async (event) => {
 *   const session = await requireSession(event);
 *   // session.user is guaranteed to exist here
 *   return { user: session.user };
 * };
 * 
 * // Resource ownership check
 * export const POST = async (event) => {
 *   const session = await requireSession(event);
 *   const scan = await getScanById(db, scanId, session.user.id);
 *   
 *   // Verify user owns this resource
 *   await requireOwnership(event, scan.user_id);
 *   
 *   // Safe to proceed...
 * };
 * ```
 * 
 * ## Security Notes
 * 
 * - **User isolation**: All DB queries MUST scope to `user_id`
 * - **No cross-user access**: Use `requireOwnership()` for resource checks
 * - **Session expiry**: Sessions expire after 7 days (configured in auth-simple.ts)
 * - **No @auth/sveltekit or better-auth**: We use a custom auth stack
 * 
 * @module lib/server/auth
 */

import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SessionData, User } from './types';
import { getSession as getSessionPrimitive } from '$lib/auth-simple';
import { logger, LogEvents } from './log';

/**
 * Get the current session from the request event
 * 
 * @param event - SvelteKit RequestEvent
 * @returns SessionData if authenticated, null otherwise
 * 
 * @example
 * ```ts
 * export const load = async (event) => {
 *   const session = await getSession(event);
 *   if (!session) {
 *     // User is not authenticated
 *   }
 * };
 * ```
 */
export async function getSession(event: RequestEvent): Promise<SessionData | null> {
	// First check if session is already injected by hooks
	if (event.locals.session) {
		return event.locals.session;
	}

	// Fallback: manually fetch session (hooks might have failed)
	if (!event.platform?.env?.DB) {
		return null;
	}

	const sessionToken = event.cookies.get('session');
	if (!sessionToken) {
		return null;
	}

	try {
		const sessionData = await getSessionPrimitive(event.platform.env.DB, sessionToken);
		return sessionData;
	} catch (error) {
		logger.error(LogEvents.AUTH_SESSION_FETCH_FAILED, {
			error: error instanceof Error ? error.message : 'Unknown error',
			hasToken: !!sessionToken
		});
		return null;
	}
}

/**
 * Require authentication for a route
 * Throws redirect to /login if user is not authenticated
 * 
 * @param event - SvelteKit RequestEvent
 * @param redirectTo - Optional custom redirect URL (default: /login)
 * @returns SessionData (guaranteed to exist or redirect is thrown)
 * 
 * @example
 * ```ts
 * export const load = async (event) => {
 *   const session = await requireSession(event);
 *   // session.user is guaranteed to exist here
 *   return { user: session.user };
 * };
 * ```
 */
export async function requireSession(
	event: RequestEvent,
	redirectTo: string = '/login'
): Promise<SessionData> {
	const session = await getSession(event);

	if (!session) {
		throw redirect(303, redirectTo);
	}

	return session;
}

/**
 * Get the current user or null
 * Convenience helper that extracts just the user object
 * 
 * @param event - SvelteKit RequestEvent
 * @returns User if authenticated, null otherwise
 */
export async function getUser(event: RequestEvent): Promise<User | null> {
	const session = await getSession(event);
	return session?.user || null;
}

/**
 * Require user authentication (alias for requireSession)
 * Returns just the User object for convenience
 * 
 * @param event - SvelteKit RequestEvent
 * @returns User (guaranteed to exist or redirect is thrown)
 */
export async function requireUser(event: RequestEvent): Promise<User> {
	const session = await requireSession(event);
	return session.user;
}

/**
 * Check if the current user has permission to access a resource
 * 
 * @param event - SvelteKit RequestEvent
 * @param resourceUserId - The user ID that owns the resource
 * @returns true if user owns the resource, false otherwise
 * 
 * @example
 * ```ts
 * const session = await requireSession(event);
 * if (!canAccessResource(event, scan.user_id)) {
 *   throw error(403, 'Access denied');
 * }
 * ```
 */
export async function canAccessResource(
	event: RequestEvent,
	resourceUserId: string
): Promise<boolean> {
	const user = await getUser(event);
	if (!user) return false;
	return user.id === resourceUserId;
}

/**
 * Require that the current user owns a resource
 * Throws 403 error if user doesn't own the resource
 * 
 * @param event - SvelteKit RequestEvent
 * @param resourceUserId - The user ID that owns the resource
 */
export async function requireOwnership(
	event: RequestEvent,
	resourceUserId: string
): Promise<void> {
	const user = await requireUser(event);
	if (user.id !== resourceUserId) {
		throw new Error('Access denied: You do not own this resource');
	}
}
