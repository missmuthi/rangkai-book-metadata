-- Migration: 20251201_add_ai_log
-- Purpose: Add `ai_log` column (TEXT) to `scans` table used by AI features

ALTER TABLE scans ADD COLUMN ai_log TEXT;
