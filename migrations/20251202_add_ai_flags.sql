-- Migration: 20251202_add_ai_flags
-- Purpose: Add `is_ai_enhanced` (INTEGER/boolean) and `enhanced_at` (INTEGER) to `scans` table

ALTER TABLE scans ADD COLUMN is_ai_enhanced INTEGER DEFAULT 0;
ALTER TABLE scans ADD COLUMN enhanced_at INTEGER;

-- Populate columns from existing JSON data if present
UPDATE scans
SET is_ai_enhanced = CASE
  WHEN json_extract(json_data, '$.is_ai_enhanced') = 'true' THEN 1
  WHEN json_extract(json_data, '$.is_ai_enhanced') = 1 THEN 1
  ELSE 0 END;

UPDATE scans
SET enhanced_at = json_extract(json_data, '$.enhanced_at')
WHERE json_extract(json_data, '$.enhanced_at') IS NOT NULL;

-- Add indexes for efficient query/filter
CREATE INDEX IF NOT EXISTS idx_scans_is_ai_enhanced ON scans(is_ai_enhanced);
CREATE INDEX IF NOT EXISTS idx_scans_enhanced_at ON scans(enhanced_at DESC);
