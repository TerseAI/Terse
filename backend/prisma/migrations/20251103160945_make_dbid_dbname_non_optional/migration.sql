/*
  Warnings:

  - Made the column `database_id` on table `automation_notion_configs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `database_name` on table `automation_notion_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "automation_notion_configs" ALTER COLUMN "database_id" SET NOT NULL,
ALTER COLUMN "database_name" SET NOT NULL;

-- AlterTable
ALTER TABLE "pending_approvals" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '24 hours';
