/*
  Warnings:

  - Made the column `repository_id` on table `github_repositories` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "github_repositories_repository_id_key";

-- Update existing NULL values to unique negative values to avoid unique constraint violations
-- The unique constraint is on [installation_id, repository_id], so we need unique values per installation_id
WITH numbered_rows AS (
  SELECT 
    id,
    installation_id,
    -ROW_NUMBER() OVER (PARTITION BY installation_id ORDER BY id) AS new_repository_id
  FROM "github_repositories"
  WHERE "repository_id" IS NULL
)
UPDATE "github_repositories" gr
SET "repository_id" = nr.new_repository_id
FROM numbered_rows nr
WHERE gr.id = nr.id;

-- AlterTable
ALTER TABLE "github_repositories" ALTER COLUMN "repository_id" SET NOT NULL,
ALTER COLUMN "repository_id" SET DEFAULT 0;
