-- Add event_key column
ALTER TABLE "chat_raw_events" ADD COLUMN "event_key" TEXT;
ALTER TABLE "run_history_raw_events" ADD COLUMN "event_key" TEXT;

-- Enforce NOT NULL (backfill script must run before this migration on existing data)
ALTER TABLE "chat_raw_events" ALTER COLUMN "event_key" SET NOT NULL;
ALTER TABLE "run_history_raw_events" ALTER COLUMN "event_key" SET NOT NULL;
