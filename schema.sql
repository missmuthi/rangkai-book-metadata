-- Rangkai Book Metadata - D1 Database Schema
-- Version: 1.1
-- Purpose: Store scan history for ISBN lookups with optimized retrieval

-- Drop existing table if re-initializing (use with caution in production)
-- DROP TABLE IF EXISTS scans;

-- Create scans table
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT NOT NULL,
    title TEXT,
    json_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create B-Tree index on isbn for optimized lookups
-- This significantly improves query performance for ISBN-based searches
CREATE INDEX IF NOT EXISTS idx_scans_isbn ON scans(isbn);

-- Optional: Create index on created_at for time-based queries (e.g., recent scans)
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- Sample query patterns this schema supports:
-- 1. Find scan by ISBN: SELECT * FROM scans WHERE isbn = ? ORDER BY created_at DESC LIMIT 1;
-- 2. Get recent scans: SELECT * FROM scans ORDER BY created_at DESC LIMIT 50;
-- 3. Search by title: SELECT * FROM scans WHERE title LIKE ? ORDER BY created_at DESC;
-- 4. Count scans: SELECT COUNT(*) FROM scans;
