-- CreateIndex (run AFTER backfill script has populated all event_key values)
CREATE UNIQUE INDEX "chat_raw_events_event_key_key" ON "chat_raw_events"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "run_history_raw_events_event_key_key" ON "run_history_raw_events"("event_key");
