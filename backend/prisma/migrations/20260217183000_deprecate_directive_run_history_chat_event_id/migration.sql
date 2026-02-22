-- Deprecate directive_records.run_history_chat_event_id:
-- keep column for backward compatibility but stop requiring it.

ALTER TABLE "directive_records" DROP CONSTRAINT "directive_records_run_history_chat_event_id_fkey";

ALTER TABLE "directive_records"
ALTER COLUMN "run_history_chat_event_id" DROP NOT NULL;

ALTER TABLE "directive_records"
ADD CONSTRAINT "directive_records_run_history_chat_event_id_fkey"
FOREIGN KEY ("run_history_chat_event_id") REFERENCES "run_history_chat_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
