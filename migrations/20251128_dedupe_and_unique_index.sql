-- ============================================
-- Migration: Deduplicate scans and add UNIQUE INDEX
-- Date: November 28, 2025
-- Purpose: Prevent duplicate scans for same user+isbn pair
-- ============================================

-- STEP 1: PRE-MIGRATION - Delete duplicate scans, keeping only the most recent
-- This MUST be run BEFORE creating the unique index

-- First, let's see how many duplicates exist (for logging)
-- SELECT user_id, isbn, COUNT(*) as cnt 
-- FROM scans 
-- GROUP BY user_id, isbn 
-- HAVING cnt > 1;

-- Delete duplicates, keeping only the row with the highest id (most recent) for each user_id+isbn pair
DELETE FROM scans 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM scans 
    GROUP BY user_id, isbn
);

-- STEP 2: Create UNIQUE INDEX on (user_id, isbn)
-- This prevents future duplicates at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_user_isbn_unique ON scans (user_id, isbn);

-- STEP 3: Verify the index was created
-- SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='scans';
