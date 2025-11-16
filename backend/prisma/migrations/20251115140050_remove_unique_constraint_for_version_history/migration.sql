-- Remove unique constraint on [automation_id, status] to allow multiple PRODUCTION versions
-- This enables full version history tracking for published automations

-- Drop the unique constraint
ALTER TABLE "automation_versions" DROP CONSTRAINT IF EXISTS "automation_versions_automation_id_status_key";

-- Add index for efficient queries of active production versions
CREATE INDEX IF NOT EXISTS "automation_versions_automation_id_status_is_active_idx" ON "automation_versions"("automation_id", "status", "is_active");

