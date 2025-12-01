// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/**
 * Import server types for type consistency
 * This ensures App.Locals types match lib/server/types.ts
 */
import type { User, SessionData } from "$lib/server/types";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /**
       * Full session data with user and session info
       * Populated by hooks.server.ts on each request
       */
      session: SessionData | null;
      /**
       * Convenience accessor for current user
       * Populated by hooks.server.ts on each request
       */
      user: User | null;
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
        /** (Legacy) Google Generative AI API Key for AI cleaning - optional */
        GOOGLE_GENERATIVE_AI_API_KEY: string;
        /** Groq / OpenAI-compatible API Key for AI cleaning (llama-3.3) */
        GROQ_API_KEY: string;
        /** Groq / OpenAI-compatible API Key for AI cleaning (llama-3.3) */
        GROQ_API_KEY: string;
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
        waitUntil(promise: Promise<unknown>): void;
      };
      /** Cloudflare request metadata */
      cf: CfProperties;
    }
  }
}

export {};
