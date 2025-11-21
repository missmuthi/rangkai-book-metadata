/**
 * Better Auth API Route
 * Handles all authentication requests: /api/auth/*
 * 
 * Routes handled:
 * - POST /api/auth/sign-in
 * - POST /api/auth/sign-up
 * - POST /api/auth/sign-out
 * - GET /api/auth/session
 * - GET /api/auth/callback/google (OAuth callback)
 */

import { getAuthWithPlatform } from '$lib/auth';
import type { RequestHandler } from './$types';

/**
 * Handle all HTTP methods (GET, POST, etc.) for auth routes
 * Better Auth automatically handles routing based on the path
 */
export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return new Response('Database not configured', { status: 500 });
	}
	
	const auth = getAuthWithPlatform(event.platform.env.DB, event.url.origin);
	return auth.handler(event.request);
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return new Response('Database not configured', { status: 500 });
	}
	
	const auth = getAuthWithPlatform(event.platform.env.DB, event.url.origin);
	return auth.handler(event.request);
};

export const PUT: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return new Response('Database not configured', { status: 500 });
	}
	
	const auth = getAuthWithPlatform(event.platform.env.DB, event.url.origin);
	return auth.handler(event.request);
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return new Response('Database not configured', { status: 500 });
	}
	
	const auth = getAuthWithPlatform(event.platform.env.DB, event.url.origin);
	return auth.handler(event.request);
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return new Response('Database not configured', { status: 500 });
	}
	
	const auth = getAuthWithPlatform(event.platform.env.DB, event.url.origin);
	return auth.handler(event.request);
};
