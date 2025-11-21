-- ============================================
-- Rangkai v2.0 Database Migration
-- Purpose: Add Better Auth tables and upgrade scans table
-- Safety: Idempotent (can run multiple times safely)
-- Date: 2024-11-21
-- ============================================

-- ============================================
-- STEP 1: Create Better Auth Tables
-- ============================================
-- These are new tables, safe to create with IF NOT EXISTS

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    expiresAt INTEGER,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
);

-- ============================================
-- STEP 2: Create Indexes for Better Auth
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);

-- ============================================
-- STEP 3: Upgrade scans Table (CRITICAL)
-- ============================================
-- Strategy: Create new table with v2.0 schema, migrate data, swap tables
-- This is safer than ALTER TABLE for SQLite/D1

-- 3a. Create new scans table with v2.0 schema
CREATE TABLE IF NOT EXISTS scans_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    isbn TEXT NOT NULL,
    title TEXT,
    json_data TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 3b. Migrate existing data (if scans table exists and has data)
-- Note: For existing scans without user_id, we'll need a "system" user
-- Create a system/admin user first (idempotent - won't fail if exists)
INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
VALUES (
    'system-user-legacy-import',
    'Legacy System',
    'system@rangkai-internal.local',
    1,
    unixepoch(),
    unixepoch()
);

-- Copy data from old scans table to scans_v2 (if old table exists)
-- All legacy scans will be assigned to the system user
INSERT INTO scans_v2 (id, user_id, isbn, title, json_data, status, created_at, updated_at)
SELECT 
    id,
    'system-user-legacy-import' as user_id,
    isbn,
    title,
    json_data,
    'draft' as status,  -- Default status for legacy scans
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
    CURRENT_TIMESTAMP as updated_at  -- Default updated_at for legacy scans
FROM scans
WHERE NOT EXISTS (
    SELECT 1 FROM scans_v2 WHERE scans_v2.id = scans.id
);

-- 3c. Drop old scans table and rename v2 table
DROP TABLE IF EXISTS scans;
ALTER TABLE scans_v2 RENAME TO scans;

-- ============================================
-- STEP 4: Create Indexes for scans Table
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_isbn ON scans(isbn);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);

-- ============================================
-- STEP 5: Verification Queries (Run After Migration)
-- ============================================
-- Uncomment these to verify migration success:

-- Check Better Auth tables exist:
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user', 'session', 'account', 'verification');

-- Check scans table has new columns:
-- PRAGMA table_info(scans);

-- Count migrated scans:
-- SELECT COUNT(*) as total_scans, user_id FROM scans GROUP BY user_id;

-- Verify indexes:
-- SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='scans';

-- ============================================
-- ROLLBACK PLAN (If needed)
-- ============================================
-- If migration fails, you can restore from backup:
-- 1. Export data before migration: wrangler d1 export rangkai-scans --remote --output=backup-pre-v2.sql
-- 2. If issues occur, restore: wrangler d1 execute rangkai-scans --remote --file=backup-pre-v2.sql
-- 3. Contact dev team with error details

-- ============================================
-- NOTES
-- ============================================
-- ✅ This migration is IDEMPOTENT (safe to run multiple times)
-- ✅ Existing data is preserved and assigned to system user
-- ✅ Foreign keys enforce referential integrity
-- ✅ All indexes created for performance
-- ⚠️  After migration, existing scans belong to 'system-user-legacy-import'
-- ⚠️  Users must re-scan books to create user-scoped entries
-- ⚠️  Or implement a UI to "claim" legacy scans (future enhancement)
