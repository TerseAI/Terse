-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'PRODUCTION');

-- CreateTable: automation_versions
CREATE TABLE "automation_versions" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_versions_automation_id_idx" ON "automation_versions"("automation_id");
CREATE INDEX "automation_versions_status_idx" ON "automation_versions"("status");
CREATE INDEX "automation_versions_automation_id_status_idx" ON "automation_versions"("automation_id", "status");

-- CreateUniqueConstraint: One draft and one production per automation
CREATE UNIQUE INDEX "automation_versions_automation_id_status_key" ON "automation_versions"("automation_id", "status");

-- AddForeignKey
ALTER TABLE "automation_versions" ADD CONSTRAINT "automation_versions_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: Create production versions for all existing automations
-- Generate unique IDs using a sequence-like approach
DO $$
DECLARE
    automation_record RECORD;
    version_id TEXT;
    counter INTEGER := 0;
BEGIN
    FOR automation_record IN SELECT * FROM "automations" LOOP
        counter := counter + 1;
        -- Generate a unique ID using automation_id + counter + timestamp
        -- This ensures uniqueness while being deterministic enough for migration
        version_id := 'av_' || substring(automation_record.id, 1, 20) || '_' || counter::text || '_' || floor(extract(epoch from now()) * 1000)::text;
        
        INSERT INTO "automation_versions" ("id", "automation_id", "status", "is_active", "created_at")
        VALUES (
            version_id,
            automation_record.id,
            'PRODUCTION'::"AutomationStatus",
            automation_record.is_active,
            automation_record.created_at
        );
    END LOOP;
END $$;

-- Add automation_version_id columns to related tables (temporarily nullable)
ALTER TABLE "automation_prompts" ADD COLUMN "automation_version_id" TEXT;
ALTER TABLE "automation_inputs" ADD COLUMN "automation_version_id" TEXT;
ALTER TABLE "automation_outputs" ADD COLUMN "automation_version_id" TEXT;
ALTER TABLE "run_history_records" ADD COLUMN "automation_version_id" TEXT;

-- Migrate foreign keys: Update related tables to point to automation_versions
UPDATE "automation_prompts" ap
SET "automation_version_id" = av.id
FROM "automation_versions" av
WHERE av.automation_id = ap.automation_id AND av.status = 'PRODUCTION';

UPDATE "automation_inputs" ai
SET "automation_version_id" = av.id
FROM "automation_versions" av
WHERE av.automation_id = ai.automation_id AND av.status = 'PRODUCTION';

UPDATE "automation_outputs" ao
SET "automation_version_id" = av.id
FROM "automation_versions" av
WHERE av.automation_id = ao.automation_id AND av.status = 'PRODUCTION';

UPDATE "run_history_records" rhr
SET "automation_version_id" = av.id
FROM "automation_versions" av
WHERE av.automation_id = rhr.automation_id AND av.status = 'PRODUCTION';

-- Make automation_version_id columns NOT NULL
ALTER TABLE "automation_prompts" ALTER COLUMN "automation_version_id" SET NOT NULL;
ALTER TABLE "automation_inputs" ALTER COLUMN "automation_version_id" SET NOT NULL;
ALTER TABLE "automation_outputs" ALTER COLUMN "automation_version_id" SET NOT NULL;
ALTER TABLE "run_history_records" ALTER COLUMN "automation_version_id" SET NOT NULL;

-- Drop old foreign key constraints
ALTER TABLE "automation_prompts" DROP CONSTRAINT IF EXISTS "automation_prompts_automation_id_fkey";
ALTER TABLE "automation_inputs" DROP CONSTRAINT IF EXISTS "automation_inputs_automation_id_fkey";
ALTER TABLE "automation_outputs" DROP CONSTRAINT IF EXISTS "automation_outputs_automation_id_fkey";
ALTER TABLE "run_history_records" DROP CONSTRAINT IF EXISTS "run_history_records_automation_id_fkey";

-- Drop old columns
ALTER TABLE "automation_prompts" DROP COLUMN "automation_id";
ALTER TABLE "automation_inputs" DROP COLUMN "automation_id";
ALTER TABLE "automation_outputs" DROP COLUMN "automation_id";
ALTER TABLE "run_history_records" DROP COLUMN "automation_id";

-- Drop old indexes
DROP INDEX IF EXISTS "automation_inputs_automation_id_idx";
DROP INDEX IF EXISTS "run_history_records_automation_id_idx";

-- Create new indexes
CREATE INDEX "automation_inputs_automation_version_id_idx" ON "automation_inputs"("automation_version_id");
CREATE INDEX "run_history_records_automation_version_id_idx" ON "run_history_records"("automation_version_id");

-- Add new foreign key constraints
ALTER TABLE "automation_prompts" ADD CONSTRAINT "automation_prompts_automation_version_id_fkey" FOREIGN KEY ("automation_version_id") REFERENCES "automation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_inputs" ADD CONSTRAINT "automation_inputs_automation_version_id_fkey" FOREIGN KEY ("automation_version_id") REFERENCES "automation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_outputs" ADD CONSTRAINT "automation_outputs_automation_version_id_fkey" FOREIGN KEY ("automation_version_id") REFERENCES "automation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_history_records" ADD CONSTRAINT "run_history_records_automation_version_id_fkey" FOREIGN KEY ("automation_version_id") REFERENCES "automation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop is_active column from automations table (moved to automation_versions)
ALTER TABLE "automations" DROP COLUMN "is_active";

-- Drop old index on is_active
DROP INDEX IF EXISTS "automations_is_active_idx";
