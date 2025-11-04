/*
  Warnings:

  - Made the column `listen_to_user_dms` on table `automation_slack_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "automation_slack_configs" ALTER COLUMN "listen_to_user_dms" SET NOT NULL,
ALTER COLUMN "listen_to_user_dms" SET DEFAULT false;
