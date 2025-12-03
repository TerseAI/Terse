-- AlterTable
ALTER TABLE "automation_linear_configs" ADD COLUMN     "team_id" TEXT,
ADD COLUMN     "team_name" TEXT;

-- CreateIndex
CREATE INDEX "automation_linear_configs_team_id_idx" ON "automation_linear_configs"("team_id");
