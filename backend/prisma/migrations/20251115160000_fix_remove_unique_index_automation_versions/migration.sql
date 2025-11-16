-- Fix: Drop the unique INDEX (not constraint) on [automation_id, status] to allow multiple PRODUCTION versions
-- This enables full version history tracking for published automations

-- Drop the unique index (it was created as an index, not a constraint)
DROP INDEX IF EXISTS "automation_versions_automation_id_status_key";

-- The index for efficient queries should already exist from the previous migration
-- But ensure it exists just in case
CREATE INDEX IF NOT EXISTS "automation_versions_automation_id_status_is_active_idx" ON "automation_versions"("automation_id", "status", "is_active");

