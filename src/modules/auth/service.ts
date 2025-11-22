/**
 * Auth Module - Enhanced Authentication Helpers
 * 
 * Extended auth capabilities:
 * - Role-based access control
 * - Optional authentication
 * - Admin checks
 */

import { redirect, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getSession, requireSession as baseRequireSession } from '$lib/server';
import type { User, SessionData } from '$lib/server/types';

/**
 * User roles (extend as needed)
 */
export type UserRole = 'user' | 'admin' | 'librarian';

/**
 * Check if user has a specific role
 * Note: Current schema doesn't have roles, this is for future extension
 */
export function hasRole(user: User, role: UserRole): boolean {
	// For now, all users are 'user' role
	// In future, add a 'role' column to user table
	if (role === 'user') return true;
	
	// Admin check could be based on email domain or explicit role column
	// Example: if (user.email.endsWith('@admin.rangkai.app')) return true;
	
	return false;
}

/**
 * Get session without requiring authentication
 * Returns null if user is not logged in (no redirect)
 * 
 * @param event - SvelteKit RequestEvent
 * @returns SessionData or null
 */
export async function getSessionOptional(event: RequestEvent): Promise<SessionData | null> {
	return getSession(event);
}

/**
 * Require authentication and specific role
 * Throws redirect to /login if not authenticated
 * Throws 403 error if user doesn't have required role
 * 
 * @param event - SvelteKit RequestEvent
 * @param role - Required role
 * @returns SessionData
 */
export async function requireRole(
	event: RequestEvent,
	role: UserRole
): Promise<SessionData> {
	const session = await baseRequireSession(event);
	
	if (!hasRole(session.user, role)) {
		throw error(403, `Access denied: ${role} role required`);
	}
	
	return session;
}

/**
 * Require admin access
 * Convenience wrapper for requireRole('admin')
 * 
 * @param event - SvelteKit RequestEvent
 * @returns SessionData
 */
export async function requireAdmin(event: RequestEvent): Promise<SessionData> {
	return requireRole(event, 'admin');
}

/**
 * Require librarian access
 * Convenience wrapper for requireRole('librarian')
 * 
 * @param event - SvelteKit RequestEvent
 * @returns SessionData
 */
export async function requireLibrarian(event: RequestEvent): Promise<SessionData> {
	return requireRole(event, 'librarian');
}

/**
 * Check if current user is admin
 * Does not throw errors, returns boolean
 */
export async function isAdmin(event: RequestEvent): Promise<boolean> {
	const session = await getSession(event);
	if (!session) return false;
	return hasRole(session.user, 'admin');
}

/**
 * Check if current user is authenticated
 * Does not throw errors, returns boolean
 */
export async function isAuthenticated(event: RequestEvent): Promise<boolean> {
	const session = await getSession(event);
	return session !== null;
}

/**
 * Get user or null (convenience helper)
 */
export async function getUserOptional(event: RequestEvent): Promise<User | null> {
	const session = await getSession(event);
	return session?.user || null;
}

/**
 * Redirect to login with return URL
 * Preserves the intended destination after login
 */
export function redirectToLogin(event: RequestEvent): never {
	const returnUrl = event.url.pathname + event.url.search;
	const loginUrl = `/login?returnTo=${encodeURIComponent(returnUrl)}`;
	throw redirect(303, loginUrl);
}

/**
 * Role-based route guard for use in hooks or layouts
 * 
 * @example
 * ```typescript
 * // In +layout.server.ts
 * export const load = async (event) => {
 *   await guardRoute(event, 'admin');
 *   // Only admins can reach here
 * };
 * ```
 */
export async function guardRoute(
	event: RequestEvent,
	role?: UserRole
): Promise<SessionData> {
	const session = await baseRequireSession(event);
	
	if (role && !hasRole(session.user, role)) {
		throw error(403, 'Insufficient permissions');
	}
	
	return session;
}
