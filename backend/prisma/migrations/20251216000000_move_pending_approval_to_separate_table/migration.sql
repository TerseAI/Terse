-- Step 1: Add new columns to pending_approvals table
ALTER TABLE "pending_approvals" 
  ADD COLUMN IF NOT EXISTS "serialized_state" TEXT,
  ADD COLUMN IF NOT EXISTS "interruptions" JSONB;

-- Step 2: Migrate existing data from run_history_records to pending_approvals
-- For records that have pending_approval_state, create or update pending_approvals records
INSERT INTO "pending_approvals" (
  "id",
  "user_id",
  "run_history_record_id",
  "serialized_state",
  "interruptions",
  "created_at",
  "updated_at"
)
SELECT 
  gen_random_uuid()::text,
  a."user_id",
  rhr."id",
  CASE 
    WHEN rhr."pending_approval_state"::text IS NOT NULL 
    THEN rhr."pending_approval_state"::text
    ELSE NULL
  END,
  rhr."pending_approval_interruptions",
  rhr."created_at",
  rhr."updated_at"
FROM "run_history_records" rhr
INNER JOIN "automations" a ON rhr."automation_id" = a."id"
WHERE rhr."pending_approval_state" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "pending_approvals" pa 
    WHERE pa."run_history_record_id" = rhr."id"
  )
ON CONFLICT ("run_history_record_id") 
DO UPDATE SET
  "serialized_state" = COALESCE(EXCLUDED."serialized_state", "pending_approvals"."serialized_state"),
  "interruptions" = COALESCE(EXCLUDED."interruptions", "pending_approvals"."interruptions"),
  "updated_at" = EXCLUDED."updated_at";

-- Step 2b: Migrate data from existing run_state_json column to serialized_state
-- (for records that already exist in pending_approvals but don't have serialized_state yet)
UPDATE "pending_approvals" pa
SET "serialized_state" = COALESCE(pa."serialized_state", pa."run_state_json")
WHERE pa."run_state_json" IS NOT NULL 
  AND (pa."serialized_state" IS NULL OR pa."serialized_state" = '');

-- Step 3: Make serialized_state NOT NULL (after migration)
-- First, handle any NULL values by setting them to empty string or a default
UPDATE "pending_approvals" 
SET "serialized_state" = '{}' 
WHERE "serialized_state" IS NULL;

ALTER TABLE "pending_approvals" 
  ALTER COLUMN "serialized_state" SET NOT NULL,
  ALTER COLUMN "interruptions" SET NOT NULL;

-- Step 4: Rename old column if it exists (for backward compatibility during transition)
-- We'll keep run_state_json temporarily but it should be removed in a future migration
-- after ensuring all code uses serialized_state

-- Step 5: Drop the old columns from run_history_records
ALTER TABLE "run_history_records" 
  DROP COLUMN IF EXISTS "pending_approval_state",
  DROP COLUMN IF EXISTS "pending_approval_interruptions";

-- Step 6: Add index on run_history_record_id for faster lookups
CREATE INDEX IF NOT EXISTS "pending_approvals_run_history_record_id_idx" 
  ON "pending_approvals"("run_history_record_id");

