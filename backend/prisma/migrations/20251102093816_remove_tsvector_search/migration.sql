-- Remove tsvector full-text search columns and indexes
-- Replaced with simple LIKE queries on trigger_title

-- Drop indexes first
DROP INDEX IF EXISTS idx_run_history_records_search_fts;
DROP INDEX IF EXISTS idx_run_history_actions_search_fts;

-- Drop the generated tsvector columns
ALTER TABLE run_history_records DROP COLUMN IF EXISTS search_fts;
ALTER TABLE run_history_actions DROP COLUMN IF EXISTS search_fts;

