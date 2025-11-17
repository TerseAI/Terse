/*
  Warnings:

  - Made the column `repository_id` on table `github_repositories` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "github_repositories_repository_id_key";

-- AlterTable
ALTER TABLE "github_repositories" ALTER COLUMN "repository_id" SET NOT NULL,
ALTER COLUMN "repository_id" SET DEFAULT 0;
