-- ============================================
-- Rangkai Database Reset Script
-- Purpose: Wipe all user authentication data
-- Use Case: Testing fresh OAuth flow
-- ⚠️  WARNING: This deletes ALL user data!
-- ============================================

-- Delete in correct order (respect foreign keys)
DELETE FROM session;
DELETE FROM account;
DELETE FROM verification;
DELETE FROM scans;  -- User scans will be orphaned otherwise
DELETE FROM user;

-- Verify deletion (should return 0 rows)
SELECT COUNT(*) as remaining_users FROM user;
SELECT COUNT(*) as remaining_sessions FROM session;
SELECT COUNT(*) as remaining_accounts FROM account;
SELECT COUNT(*) as remaining_scans FROM scans;

-- ============================================
-- How to Run This Script:
-- ============================================

-- LOCAL (Development with Wrangler):
-- npx wrangler d1 execute rangkai-scans --local --file=reset-database.sql

-- REMOTE (Production - ⚠️ USE WITH EXTREME CAUTION):
-- npx wrangler d1 execute rangkai-scans --remote --file=reset-database.sql

-- ============================================
-- Alternative: Reset individual tables
-- ============================================

-- Delete only sessions (keep users):
-- DELETE FROM session;

-- Delete only a specific user:
-- DELETE FROM session WHERE userId = 'user-id-here';
-- DELETE FROM account WHERE userId = 'user-id-here';
-- DELETE FROM scans WHERE user_id = 'user-id-here';
-- DELETE FROM user WHERE id = 'user-id-here';

-- ============================================
-- Post-Reset Steps:
-- ============================================
-- 1. Clear browser cookies (or use incognito)
-- 2. Visit /login
-- 3. Sign in with Google OAuth
-- 4. Verify session is created in database
-- 5. Test sign out flow
-- 6. Verify session is deleted
