/*
  Warnings:

  - A unique constraint covering the columns `[event_key]` on the table `chat_raw_events` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[event_key]` on the table `run_history_raw_events` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "chat_raw_events_event_key_key" ON "chat_raw_events"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "run_history_raw_events_event_key_key" ON "run_history_raw_events"("event_key");
