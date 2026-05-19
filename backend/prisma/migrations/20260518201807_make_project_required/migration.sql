/*
  Warnings:

  - Made the column `project_id` on table `automations` required. This step will fail if there are existing NULL values in that column.

*/
-- Safety net: SDK automations always have project_id (set on creation in sdkDeploy).
-- Non-SDK rows with NULL project_id were already removed by the preceding migration.
-- This DELETE is a no-op under that invariant but prevents the NOT NULL constraint from failing
-- if any orphaned row slipped through (e.g. manual insert during the nullable window).
DELETE FROM "automations" WHERE "project_id" IS NULL;

-- AlterTable
ALTER TABLE "automations" ALTER COLUMN "project_id" SET NOT NULL;
