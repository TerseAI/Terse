-- AlterTable
ALTER TABLE "automation_github_configs" ADD COLUMN     "repository_ids" TEXT[];

-- CreateIndex
CREATE INDEX "automation_github_configs_repository_ids_idx" ON "automation_github_configs"("repository_ids");
