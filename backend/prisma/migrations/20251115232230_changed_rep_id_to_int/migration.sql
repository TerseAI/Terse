/*
  Warnings:

  - The `repository_ids` column on the `automation_github_configs` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "automation_github_configs" DROP COLUMN "repository_ids",
ADD COLUMN     "repository_ids" INTEGER[];

-- CreateIndex
CREATE INDEX "automation_github_configs_repository_ids_idx" ON "automation_github_configs"("repository_ids");
