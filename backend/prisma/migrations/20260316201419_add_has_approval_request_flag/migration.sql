-- AlterTable
ALTER TABLE "run_history_records" ADD COLUMN     "has_approval_request" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark existing runs that had tool approval requests
UPDATE run_history_records SET has_approval_request = true
WHERE id IN (
  SELECT DISTINCT rhr.id
  FROM run_history_records rhr
  INNER JOIN run_history_raw_events rhre ON rhre.run_history_record_id = rhr.id
  WHERE (rhre.raw_event_json->>'id') LIKE 'msg_tool_approval_request-%'
);

-- CreateIndex
CREATE INDEX "run_history_records_has_approval_request_automation_id_time_idx" ON "run_history_records"("has_approval_request", "automation_id", "timestamp");
