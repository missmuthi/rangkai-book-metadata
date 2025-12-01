// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/**
 * Import server types for type consistency
 * This ensures App.Locals types match lib/server/types.ts
 */
import type { D1Database as CloudflareD1Database } from "@cloudflare/workers-types";

// Re-export D1Database for use in other files
export type D1Database = CloudflareD1Database;

// Mock KVNamespace for legacy imports (will be removed later)
export type KVNamespace = any;

export type User = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null | undefined;
};

export type SessionData = {
  id: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  user: User; // Added back as it is used extensively
};

// Alias for Session to match usage in index.ts
export type Session = SessionData;

// D1 Database Table Types
export type Scan = {
  id: number;
  user_id: string; // Foreign Key to User
  isbn: string;
  title: string;
  json_data: string; // Serialized MergedBookData
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  // New columns for Search/Filtering
  authors?: string;
  subjects?: string;
  ddc?: string;
  lcc?: string;
  // AI audit log stored as serialized JSON string in D1
  ai_log?: string | null;
};

export type Database = {
  scans: Scan;
  // ... other tables
};
