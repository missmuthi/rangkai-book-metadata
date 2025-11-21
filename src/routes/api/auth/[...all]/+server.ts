/**
 * Lightweight OAuth Routes
 * Handles Google OAuth with Arctic + manual D1 sessions
 */

import { createGoogleAuth, generateSessionToken, createSession, upsertUser, deleteSession } from '$lib/auth-simple';
import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * Generate PKCE code verifier (base64url, 43-128 chars)
 */
function generateCodeVerifier(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * GET /api/auth/google - Initiate Google OAuth flow
 */
export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	if (!platform?.env) {
		return new Response('Platform not configured', { status: 500 });
	}
	
	const path = url.pathname;
	
	// Handle Google OAuth initiation
	if (path === '/api/auth/google') {
		const google = createGoogleAuth(platform.env);
		const state = crypto.randomUUID();
		const codeVerifier = generateCodeVerifier();
		
		// Arctic Google.createAuthorizationURL(state, codeVerifier, scopes[])
		const authUrl = await google.createAuthorizationURL(
			state,
			codeVerifier,
			['openid', 'profile', 'email'] // Google scopes as array
		);
		
		// Store state and code verifier for verification
		cookies.set('google_oauth_state', state, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 10 // 10 minutes
		});
		
		cookies.set('google_code_verifier', codeVerifier, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 10 // 10 minutes
		});
		
		throw redirect(302, authUrl.toString());
	}
	
	// Handle Google OAuth callback
	if (path === '/api/auth/callback/google') {
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const storedState = cookies.get('google_oauth_state');
		const codeVerifier = cookies.get('google_code_verifier');
		
		if (!code || !state || state !== storedState || !codeVerifier) {
			return new Response('Invalid OAuth callback', { status: 400 });
		}
		
		try {
			const google = createGoogleAuth(platform.env);
			const tokens = await google.validateAuthorizationCode(code, codeVerifier);
			
			// Fetch user info from Google
			const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: `Bearer ${tokens.accessToken()}` }
			});
			
			const googleUser = await response.json() as {
				email: string;
				name: string;
				picture: string;
			};
			
			// Create or update user
			const userId = await upsertUser(
				platform.env.DB,
				googleUser.email,
				googleUser.name,
				googleUser.picture
			);
			
			// Create session
			const sessionToken = generateSessionToken();
			await createSession(platform.env.DB, userId, sessionToken);
			
			// Set session cookie
			cookies.set('session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});
			
			// Clear OAuth state and code verifier
			cookies.delete('google_oauth_state', { path: '/' });
			cookies.delete('google_code_verifier', { path: '/' });
			
			throw redirect(302, '/');
		} catch (error) {
			// CRITICAL: Serialize error object for readable Cloudflare logs
			console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			console.error('🔴 OAUTH CALLBACK ERROR');
			console.error('Timestamp:', new Date().toISOString());
			console.error('Route: /api/auth/callback/google');
			
			if (error instanceof Error) {
				console.error('Error Type:', error.constructor.name);
				console.error('Error Message:', error.message);
				console.error('Stack Trace:', error.stack);
				// Log any additional error properties
				console.error('Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
			} else {
				// Non-Error object - serialize completely
				console.error('Non-Error Object:', JSON.stringify(error, null, 2));
			}
			
			console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			return new Response('Authentication failed', { status: 500 });
		}
	}
	
	return new Response('Not found', { status: 404 });
};

/**
 * POST /api/auth/sign-out - Sign out
 */
export const POST: RequestHandler = async ({ platform, cookies }) => {
	if (!platform?.env?.DB) {
		return new Response('Database not configured', { status: 500 });
	}
	
	const sessionToken = cookies.get('session');
	if (sessionToken) {
		await deleteSession(platform.env.DB, sessionToken);
		cookies.delete('session', { path: '/' });
	}
	
	return new Response(JSON.stringify({ success: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
