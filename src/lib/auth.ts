/**
 * Better Auth Server Configuration
 * Handles authentication with Cloudflare D1 and Google OAuth
 * 
 * Note: Better Auth with D1 requires manual adapter setup
 * We use Kysely adapter which is compatible with D1's SQLite
 */

import { betterAuth } from 'better-auth';

/**
 * Helper function to get auth instance with platform context
 * Use this in SvelteKit server routes
 * 
 * CRITICAL: Cloudflare Workers does NOT have process.env!
 * All environment variables must be passed explicitly from platform.env
 * 
 * @param env - Full environment object from platform.env (includes DB, secrets, etc.)
 */
export function getAuthWithPlatform(env: App.Platform['env']) {
	return betterAuth({
		// Explicitly pass the secret (Better Auth needs this)
		secret: env.BETTER_AUTH_SECRET,
		
		// Base URL for callbacks (MUST be production URL, not localhost)
		baseURL: env.BETTER_AUTH_URL,
		
		database: {
			// D1 uses SQLite syntax, so we provide a custom adapter
			// that wraps D1's methods to match Better Auth's expectations
			type: 'sqlite' as const,
			
			// Provide the D1 instance
			provider: env.DB,
		},
		
		// Email and password authentication (optional)
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false // Set to true in production
		},
		
		// Social authentication providers
		socialProviders: {
			google: {
				// Explicitly pull from env object (NO process.env!)
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				// Redirect URI: https://your-domain.com/api/auth/callback/google
			}
		},
		
		// Session configuration
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // Update session every 24 hours
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60 // 5 minutes
			}
		},
		
		// Trust proxy headers (important for Cloudflare)
		trustedOrigins: [
			env.BETTER_AUTH_URL
		],
		
		// Advanced options
		advanced: {
			generateId: () => {
				// Use crypto.randomUUID() for generating IDs
				return crypto.randomUUID();
			},
			cookiePrefix: 'rangkai'
		}
	});
}

// Export types for use in routes
export type Auth = ReturnType<typeof getAuthWithPlatform>;
