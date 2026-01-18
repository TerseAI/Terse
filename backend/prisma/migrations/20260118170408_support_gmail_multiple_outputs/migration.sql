-- AlterEnum
ALTER TYPE "OutputConfigType" ADD VALUE 'GMAIL';

-- DropIndex
DROP INDEX "automation_outputs_automation_id_key";

-- AlterTable
ALTER TABLE "automation_slack_configs" ADD COLUMN     "acknowledge_with_emoji" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "automation_outputs_automation_id_idx" ON "automation_outputs"("automation_id");
