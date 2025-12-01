-- ============================================
-- Migration: Add AI enhancement flags to scans
-- Date: 2025-12-02
-- Purpose: Add flags to mark scans that have been enhanced by AI
-- ============================================

-- Boolean-ish flag (0/1) for whether AI has enhanced the record
ALTER TABLE scans ADD COLUMN is_ai_enhanced INTEGER DEFAULT 0;

-- Timestamp when AI enhancement occurred (Unix epoch ms or secs); we use an INTEGER
ALTER TABLE scans ADD COLUMN enhanced_at INTEGER;

-- Optionally, create an index on enhanced_at for queries that sort/filter by latest
CREATE INDEX IF NOT EXISTS idx_scans_enhanced_at ON scans(enhanced_at DESC);

