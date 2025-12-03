-- ============================================
-- Migration: Add scans_history table for row-versioning
-- Date: 2025-12-03
-- Purpose: Track full snapshots of scan records for audit and recovery
-- ============================================

-- History table — full snapshot per version
CREATE TABLE IF NOT EXISTS scans_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    snapshot_at INTEGER NOT NULL,
    -- Snapshot of all scan fields
    user_id TEXT NOT NULL,
    isbn TEXT NOT NULL,
    title TEXT,
    json_data TEXT,
    status TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    ai_log TEXT,
    is_ai_enhanced INTEGER,
    enhanced_at INTEGER,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

-- Indexes for efficient history queries
CREATE INDEX IF NOT EXISTS idx_scans_history_scan_id ON scans_history(scan_id);
CREATE INDEX IF NOT EXISTS idx_scans_history_isbn ON scans_history(isbn);
CREATE INDEX IF NOT EXISTS idx_scans_history_snapshot_at ON scans_history(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_history_scan_version ON scans_history(scan_id, version DESC);

-- ============================================
-- USAGE NOTES:
-- ============================================
-- 1. Get all versions for a scan: SELECT * FROM scans_history WHERE scan_id = ? ORDER BY version DESC;
-- 2. Get latest snapshot: SELECT * FROM scans_history WHERE scan_id = ? ORDER BY version DESC LIMIT 1;
-- 3. Restore to version: Use snapshot data to UPDATE scans SET ... WHERE id = ?;
-- 4. Track changes over time: Compare json_data between consecutive versions
