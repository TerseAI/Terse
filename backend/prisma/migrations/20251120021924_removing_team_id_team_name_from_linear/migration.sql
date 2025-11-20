/*
  Warnings:

  - You are about to drop the column `team_id` on the `linear_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `team_name` on the `linear_integrations` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "linear_integrations_workspace_id_team_id_idx";

-- AlterTable
ALTER TABLE "linear_integrations" DROP COLUMN "team_id",
DROP COLUMN "team_name";

-- CreateIndex
CREATE INDEX "linear_integrations_workspace_id_idx" ON "linear_integrations"("workspace_id");
