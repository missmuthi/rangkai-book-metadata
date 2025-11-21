// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				BOOK_CACHE: KVNamespace;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			cf: CfProperties;
		}
	}
}

export {};
