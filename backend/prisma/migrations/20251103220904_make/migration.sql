/*
  Warnings:

  - Made the column `authed_user_access_token` on table `user_slack_integrations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "user_slack_integrations" ALTER COLUMN "authed_user_access_token" SET NOT NULL;
