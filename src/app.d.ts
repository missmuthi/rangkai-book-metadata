// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				user: {
					id: string;
					name: string | null;
					email: string;
					image: string | null;
				};
				session: {
					token: string;
					expiresAt: Date;
					userId: string;
				};
			} | null;
			user: {
				id: string;
				name: string | null;
				email: string;
				image: string | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		/**
		 * Cloudflare Pages Platform Interface
		 * Type-safe bindings for D1, KV, and Workers context
		 * 
		 * Audit Fix: Proper type definitions for waitUntil pattern
		 */
		interface Platform {
			env: {
				/** D1 Database for persistent storage */
				DB: D1Database;
				/** KV Namespace for 24-hour book metadata cache */
				BOOK_CACHE: KVNamespace;
				/** Better Auth secret for session encryption */
				BETTER_AUTH_SECRET: string;
				/** Better Auth base URL for OAuth callbacks */
				BETTER_AUTH_URL: string;
				/** Google OAuth Client ID */
				GOOGLE_CLIENT_ID: string;
				/** Google OAuth Client Secret */
				GOOGLE_CLIENT_SECRET: string;
			};
			/** 
			 * Cloudflare Workers context for background tasks
			 * Critical: Use waitUntil to prevent zombie promises
			 */
			context: {
				/**
				 * Schedule background work after response is sent
				 * Prevents data loss from promise termination
				 */
				waitUntil(promise: Promise<any>): void;
			};
			/** Cloudflare request metadata */
			cf: CfProperties;
		}
	}
}

export {};
