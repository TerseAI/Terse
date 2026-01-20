-- DropIndex
DROP INDEX "automation_outputs_automation_id_key";

-- CreateIndex
CREATE INDEX "automation_outputs_automation_id_idx" ON "automation_outputs"("automation_id");
