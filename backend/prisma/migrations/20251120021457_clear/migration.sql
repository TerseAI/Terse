/*
  Warnings:

  - Made the column `workspace_id` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workspace_name` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `team_id` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `team_name` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `refresh_token` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `token_expiry` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "linear_integrations" ALTER COLUMN "workspace_id" SET NOT NULL,
ALTER COLUMN "workspace_name" SET NOT NULL,
ALTER COLUMN "team_id" SET NOT NULL,
ALTER COLUMN "team_name" SET NOT NULL,
ALTER COLUMN "refresh_token" SET NOT NULL,
ALTER COLUMN "token_expiry" SET NOT NULL;
