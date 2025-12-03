import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Users table (Better Auth)
export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: integer("emailVerified").notNull().default(0),
  image: text("image"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const sessions = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  token: text("token").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const accounts = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  expiresAt: integer("expiresAt"),
  password: text("password"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  createdAt: integer("createdAt"),
  updatedAt: integer("updatedAt"),
});

// Scans table
export const scans = sqliteTable("scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  isbn: text("isbn").notNull(),
  title: text("title"),
  json_data: text("json_data"),
  status: text("status").default("draft"),
  authors: text("authors"),
  subjects: text("subjects"),
  ddc: text("ddc"),
  lcc: text("lcc"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
  // AI enhancement auditing
  ai_log: text("ai_log"),
  is_ai_enhanced: integer("is_ai_enhanced").default(0),
  enhanced_at: integer("enhanced_at"),
});

// Scans history table — full snapshot versioning for audit & recovery
export const scans_history = sqliteTable("scans_history", {
  history_id: integer("history_id").primaryKey({ autoIncrement: true }),
  scan_id: integer("scan_id").notNull(),
  version: integer("version").notNull(),
  snapshot_at: integer("snapshot_at").notNull(),
  // Snapshot of all scan fields
  user_id: text("user_id").notNull(),
  isbn: text("isbn").notNull(),
  title: text("title"),
  json_data: text("json_data"),
  status: text("status"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
  ai_log: text("ai_log"),
  is_ai_enhanced: integer("is_ai_enhanced"),
  enhanced_at: integer("enhanced_at"),
});

// Organization tables (Better Auth)
export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
  metadata: text("metadata"),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  inviterId: text("inviterId")
    .notNull()
    .references(() => users.id),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Scan = typeof scans.$inferSelect;
export type ScanHistory = typeof scans_history.$inferSelect;
export type Organization = typeof organization.$inferSelect;
export type Member = typeof member.$inferSelect;
export type Invitation = typeof invitation.$inferSelect;
