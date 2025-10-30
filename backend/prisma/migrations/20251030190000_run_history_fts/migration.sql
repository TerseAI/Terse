ALTER TABLE run_history_records
ADD COLUMN search_fts tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(trigger_type, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(trigger_source, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(trigger_title, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(trigger_subheader, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(trigger_url, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(decision_reason, '')), 'B')
) STORED;

ALTER TABLE run_history_actions
ADD COLUMN search_fts tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(type, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(target, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(details, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(url, '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_run_history_records_search_fts ON run_history_records USING GIN (search_fts);
CREATE INDEX IF NOT EXISTS idx_run_history_actions_search_fts ON run_history_actions USING GIN (search_fts);

