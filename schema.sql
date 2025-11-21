-- Rangkai Book Metadata - D1 Database Schema
-- Version: 2.0 (Multi-User Support with Better Auth)
-- Purpose: Store scan history for ISBN lookups with user authentication

-- ============================================
-- BETTER AUTH TABLES (Required)
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

-- Sessions table
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

-- Accounts table (for OAuth providers like Google)
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

-- Verification table (for email verification)
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
);

-- ============================================
-- APPLICATION TABLES
-- ============================================

-- Scans table (Modified for multi-user support)
CREATE TABLE IF NOT EXISTS scans (
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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Better Auth indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);

-- Application indexes
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_isbn ON scans(isbn);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);

-- Composite index for user-specific queries
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);

-- ============================================
-- SAMPLE QUERY PATTERNS (v2.0)
-- ============================================
-- 1. Get user's scans: SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 50;
-- 2. Find scan by ISBN (user-specific): SELECT * FROM scans WHERE user_id = ? AND isbn = ? ORDER BY created_at DESC LIMIT 1;
-- 3. Get draft scans: SELECT * FROM scans WHERE user_id = ? AND status = 'draft' ORDER BY created_at DESC;
-- 4. Count user's scans: SELECT COUNT(*) FROM scans WHERE user_id = ?;
-- 5. Get recent scans (all users - admin): SELECT s.*, u.name, u.email FROM scans s JOIN user u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 100;
