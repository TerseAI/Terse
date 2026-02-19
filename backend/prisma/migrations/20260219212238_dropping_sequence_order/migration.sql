/*
  Warnings:

  - You are about to drop the column `sequence_order` on the `chat_raw_events` table. All the data in the column will be lost.
  - You are about to drop the column `sequence_order` on the `run_history_raw_events` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "chat_raw_events_chat_session_id_sequence_order_idx";

-- DropIndex
DROP INDEX "run_history_raw_events_run_history_record_id_sequence_order_idx";

-- AlterTable
ALTER TABLE "chat_raw_events" DROP COLUMN "sequence_order";

-- AlterTable
ALTER TABLE "run_history_raw_events" DROP COLUMN "sequence_order";

-- CreateIndex
CREATE INDEX "chat_raw_events_chat_session_id_event_key_idx" ON "chat_raw_events"("chat_session_id", "event_key");

-- CreateIndex
CREATE INDEX "run_history_raw_events_run_history_record_id_event_key_idx" ON "run_history_raw_events"("run_history_record_id", "event_key");
