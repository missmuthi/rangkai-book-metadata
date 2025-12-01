-- ============================================
-- Migration: Add AI audit log column to scans
-- Date: 2025-12-01
-- Purpose: Add ai_log to persist AI-generated changes audit trail
-- ============================================

-- Add ai_log as TEXT (JSON array stored as text)
ALTER TABLE scans ADD COLUMN ai_log TEXT;

-- Optional: Sanity check - We cannot add constraints here; ensure defaults are set in code

