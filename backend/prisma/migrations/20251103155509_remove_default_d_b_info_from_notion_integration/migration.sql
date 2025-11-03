/*
  Warnings:

  - You are about to drop the column `database_id` on the `notion_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `database_name` on the `notion_integrations` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."notion_integrations_workspace_id_database_id_idx";

-- AlterTable
ALTER TABLE "notion_integrations" DROP COLUMN "database_id",
DROP COLUMN "database_name";

-- AlterTable
ALTER TABLE "pending_approvals" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '24 hours';

-- CreateIndex
CREATE INDEX "notion_integrations_workspace_id_idx" ON "notion_integrations"("workspace_id");
