-- Add event_key column
ALTER TABLE "chat_raw_events" ADD COLUMN "event_key" TEXT;
ALTER TABLE "run_history_raw_events" ADD COLUMN "event_key" TEXT;