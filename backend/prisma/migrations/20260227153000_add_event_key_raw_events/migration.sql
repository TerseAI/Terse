-- Add event_key to raw event tables in a phased manner to avoid write failures on existing rows.

-- 1) Add nullable columns first.
ALTER TABLE "run_history_raw_events"
ADD COLUMN "event_key" TEXT;

ALTER TABLE "chat_raw_events"
ADD COLUMN "event_key" TEXT;

-- 2) Backfill deterministic keys for legacy rows.
UPDATE "run_history_raw_events"
SET "event_key" = CONCAT('legacy:', "id")
WHERE "event_key" IS NULL;

UPDATE "chat_raw_events"
SET "event_key" = CONCAT('legacy:', "id")
WHERE "event_key" IS NULL;

-- 3) Enforce required columns.
ALTER TABLE "run_history_raw_events"
ALTER COLUMN "event_key" SET NOT NULL;

ALTER TABLE "chat_raw_events"
ALTER COLUMN "event_key" SET NOT NULL;

-- 4) Enforce per-session uniqueness for dedupe semantics.
CREATE UNIQUE INDEX "run_history_raw_events_run_history_record_id_event_key_key"
ON "run_history_raw_events"("run_history_record_id", "event_key");

CREATE UNIQUE INDEX "chat_raw_events_chat_session_id_event_key_key"
ON "chat_raw_events"("chat_session_id", "event_key");
