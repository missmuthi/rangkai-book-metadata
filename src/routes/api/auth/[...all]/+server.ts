/**
 * Lightweight OAuth Routes
 * Handles Google OAuth with Arctic + manual D1 sessions
 */

import { createGoogleAuth, generateSessionToken, createSession, upsertUser, deleteSession } from '$lib/auth-simple';
import type { RequestHandler } from './$types';
import { redirect, isRedirect } from '@sveltejs/kit';

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
export const GET: RequestHandler = async ({ url, platform, cookies, request }) => {
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
		
		// Store timestamp to prevent replay attacks
		cookies.set('google_oauth_timestamp', Date.now().toString(), {
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
		const timestamp = cookies.get('google_oauth_timestamp');
		
		// Validate state freshness (prevent replay attacks)
		if (timestamp) {
			const elapsed = Date.now() - parseInt(timestamp);
			if (elapsed > 600000) { // 10 minutes
				console.warn('[OAuth] State expired, elapsed:', elapsed, 'ms');
				return new Response('OAuth state expired', { status: 400 });
			}
		}
		
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
			
			// Create session with user agent tracking
			const sessionToken = generateSessionToken();
			const userAgent = request.headers.get('user-agent') || 'Unknown';
			await createSession(platform.env.DB, userId, sessionToken, userAgent);
			
			// Set session cookie
			cookies.set('session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});
			
			// Clear OAuth state, code verifier, and timestamp
			cookies.delete('google_oauth_state', { path: '/' });
			cookies.delete('google_code_verifier', { path: '/' });
			cookies.delete('google_oauth_timestamp', { path: '/' });
			
			console.log('[OAuth] ✅ Login successful for user:', googleUser.email);
			
			// Redirect to home page (stable route)
			throw redirect(303, '/');
		} catch (error) {
			// ⚠️ CRITICAL: SvelteKit throws redirects as errors - we must re-throw them!
			if (isRedirect(error)) {
				throw error; // Allow the redirect to propagate
			}
			
			// Log actual errors
			console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			console.error('🔴 OAUTH CALLBACK ERROR');
			console.error('Timestamp:', new Date().toISOString());
			console.error('Route: /api/auth/callback/google');
			
			if (error instanceof Error) {
				console.error('Error Type:', error.constructor.name);
				console.error('Error Message:', error.message);
				console.error('Stack Trace:', error.stack);
			} else {
				console.error('Unknown Error:', error);
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
		try {
			await deleteSession(platform.env.DB, sessionToken);
			console.log('[Sign Out] ✅ Session deleted from database:', sessionToken.substring(0, 8) + '...');
		} catch (error) {
			console.error('[Sign Out] ❌ Failed to delete session from database:', error);
		}
	}
	
	// Delete session cookie (match exact attributes from creation)
	cookies.delete('session', {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax'
	});
	
	console.log('[Sign Out] ✅ Session cookie deleted');
	
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store, no-cache, must-revalidate, private',
			'Pragma': 'no-cache',
			'Expires': '0'
		}
	});
};
