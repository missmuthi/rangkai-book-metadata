-- ============================================
-- Rangkai Organization Tables Migration
-- Purpose: Add Better Auth organization, member, and invitation tables
-- Safety: Idempotent (can run multiple times safely)
-- Date: 2024-12-03
-- ============================================

-- Organization table
CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    metadata TEXT
);

-- Member table (links users to organizations)
CREATE TABLE IF NOT EXISTS member (
    id TEXT PRIMARY KEY,
    organizationId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (organizationId) REFERENCES organization(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Invitation table (for inviting users to organizations)
CREATE TABLE IF NOT EXISTS invitation (
    id TEXT PRIMARY KEY,
    organizationId TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT,
    status TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    inviterId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (organizationId) REFERENCES organization(id) ON DELETE CASCADE,
    FOREIGN KEY (inviterId) REFERENCES user(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_organization ON member(organizationId);
CREATE INDEX IF NOT EXISTS idx_member_user ON member(userId);
CREATE INDEX IF NOT EXISTS idx_invitation_organization ON invitation(organizationId);
CREATE INDEX IF NOT EXISTS idx_invitation_email ON invitation(email);
CREATE INDEX IF NOT EXISTS idx_invitation_status ON invitation(status);
