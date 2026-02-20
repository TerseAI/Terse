
-- Enforce NOT NULL (backfill script must run before this migration on existing data)
ALTER TABLE "chat_raw_events" ALTER COLUMN "event_key" SET NOT NULL;
ALTER TABLE "run_history_raw_events" ALTER COLUMN "event_key" SET NOT NULL;


-- CreateIndex (run AFTER backfill script has populated all event_key values)
CREATE UNIQUE INDEX "chat_raw_events_event_key_key" ON "chat_raw_events"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "run_history_raw_events_event_key_key" ON "run_history_raw_events"("event_key");
