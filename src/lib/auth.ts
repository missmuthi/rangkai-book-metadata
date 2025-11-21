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
 * @param db - D1Database instance from platform.env.DB
 * @param baseURL - Base URL for OAuth callbacks
 */
export function getAuthWithPlatform(db: App.Platform['env']['DB'], baseURL?: string) {
	return betterAuth({
		database: {
			// D1 uses SQLite syntax, so we provide a custom adapter
			// that wraps D1's methods to match Better Auth's expectations
			type: 'sqlite' as const,
			
			// Provide the D1 instance
			provider: db,
		},
		
		// Email and password authentication (optional)
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false // Set to true in production
		},
		
		// Social authentication providers
		socialProviders: {
			google: {
				clientId: process.env.GOOGLE_CLIENT_ID || '',
				clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
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
		
		// Base URL for callbacks
		baseURL: baseURL || process.env.BETTER_AUTH_URL || 'http://localhost:5173',
		
		// Trust proxy headers (important for Cloudflare)
		trustedOrigins: [
			baseURL || process.env.BETTER_AUTH_URL || 'http://localhost:5173'
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
