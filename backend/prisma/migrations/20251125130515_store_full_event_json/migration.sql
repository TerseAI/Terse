-- Add event_json column to store full ModelEvent as JSON
ALTER TABLE "run_history_chat_events" ADD COLUMN "event_json" JSONB;

-- Migrate existing data: reconstruct full event from event_type + event_data
UPDATE "run_history_chat_events"
SET "event_json" = jsonb_build_object(
  'type', "event_type"
) || COALESCE("event_data", '{}'::jsonb)
WHERE "event_json" IS NULL;

-- Make event_json NOT NULL now that all rows have data
ALTER TABLE "run_history_chat_events" ALTER COLUMN "event_json" SET NOT NULL;

