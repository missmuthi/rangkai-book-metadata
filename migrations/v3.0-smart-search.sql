-- Rangkai v3.0 Smart Search Migration
-- Phase 2: Add searchable columns to scans table
-- Date: December 1, 2025

-- Add new searchable columns
ALTER TABLE scans ADD COLUMN authors TEXT;
ALTER TABLE scans ADD COLUMN subjects TEXT;
ALTER TABLE scans ADD COLUMN ddc TEXT;
ALTER TABLE scans ADD COLUMN lcc TEXT;

-- Add unique index to prevent duplicate scans (user_id + isbn)
-- This replaces the existing logic in createScan function
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_unique ON scans(user_id, isbn);

-- Optional: Add indexes on searchable columns for performance
CREATE INDEX IF NOT EXISTS idx_scans_authors ON scans(authors);
CREATE INDEX IF NOT EXISTS idx_scans_subjects ON scans(subjects);
CREATE INDEX IF NOT EXISTS idx_scans_ddc ON scans(ddc);
CREATE INDEX IF NOT EXISTS idx_scans_lcc ON scans(lcc);