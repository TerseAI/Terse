-- CreateEnum
CREATE TYPE "AutomationSource" AS ENUM ('WEB_UI', 'SDK');

-- AlterTable
ALTER TABLE "automation_prompts" ADD COLUMN     "source_code_gcs_key" TEXT;

-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "source" "AutomationSource" NOT NULL DEFAULT 'WEB_UI';

-- CreateIndex
CREATE INDEX "automations_name_organization_id_source_idx" ON "automations"("name", "organization_id", "source");
