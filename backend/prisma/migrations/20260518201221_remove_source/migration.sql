/*
  Warnings:

  - You are about to drop the column `source` on the `automations` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "automations_name_organization_id_source_project_id_idx";


-- Remove all non sdk agents
DELETE FROM "automations" WHERE "source" != 'SDK';



-- AlterTable
ALTER TABLE "automations" DROP COLUMN "source";

-- CreateIndex
CREATE INDEX "automations_name_organization_id_project_id_idx" ON "automations"("name", "organization_id", "project_id");
