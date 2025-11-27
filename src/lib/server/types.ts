/**
 * Core entity types for server-side operations
 * Centralized type definitions for D1 database entities
 */

/**
 * User entity (from D1 'user' table)
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: number; // SQLite boolean (0 or 1)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Session entity (from D1 'session' table)
 */
export interface Session {
  id: string;
  token: string;
  userId: string;
  expiresAt: number; // Unix timestamp (milliseconds)
  userAgent: string | null;
  createdAt: number; // Unix timestamp (milliseconds)
  updatedAt: number; // Unix timestamp (milliseconds)
}

/**
 * Scan entity (from D1 'scans' table)
 */
export interface Scan {
  id?: number; // Auto-increment primary key
  user_id: string;
  isbn: string;
  title: string;
  json_data: string; // Serialized JSON
  status: "draft" | "published" | "archived";
  created_at: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

/**
 * Session data returned by getSession
 */
export interface SessionData {
  user: User;
  session: {
    token: string;
    userId: string;
    expiresAt: Date;
  };
}

/**
 * D1 database binding type (from platform)
 */
export type D1Database = App.Platform["env"]["DB"];

/**
 * KV namespace binding type (from platform)
 */
export type KVNamespace = App.Platform["env"]["BOOK_CACHE"];
