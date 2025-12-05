-- Add composite index for user filtering + time range queries on run_history_records
CREATE INDEX "run_history_records_automation_id_timestamp_idx" ON "run_history_records"("automation_id", "timestamp");

-- Add index for recent actions ORDER BY created_at DESC
CREATE INDEX "run_history_actions_created_at_idx" ON "run_history_actions"("created_at");

