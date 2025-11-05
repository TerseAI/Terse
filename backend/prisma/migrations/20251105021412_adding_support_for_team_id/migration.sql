-- AlterTable
ALTER TABLE "automation_figma_configs" ADD COLUMN     "team_id" TEXT;

-- CreateIndex
CREATE INDEX "automation_figma_configs_team_id_idx" ON "automation_figma_configs"("team_id");
