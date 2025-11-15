/*
  Warnings:

  - You are about to drop the column `repository_id` on the `automation_github_configs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[repository_id]` on the table `github_repositories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[installation_id,repository_id]` on the table `github_repositories` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "automation_github_configs_repository_id_idx";

-- AlterTable
ALTER TABLE "automation_github_configs" DROP COLUMN "repository_id";

-- AlterTable
ALTER TABLE "github_repositories" ADD COLUMN     "repository_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_repository_id_key" ON "github_repositories"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_installation_id_repository_id_key" ON "github_repositories"("installation_id", "repository_id");
