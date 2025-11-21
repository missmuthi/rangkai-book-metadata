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
		interface Platform {
			env: {
				DB: D1Database;
				BOOK_CACHE: KVNamespace;
				BETTER_AUTH_SECRET: string;
				BETTER_AUTH_URL: string;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			cf: CfProperties;
		}
	}
}

export {};
