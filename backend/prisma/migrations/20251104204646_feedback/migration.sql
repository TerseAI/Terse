/*
  Warnings:

  - You are about to drop the column `scope` on the `slack_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `user_scope` on the `slack_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `dm_channel_id` on the `user_slack_integrations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."user_slack_integrations" DROP CONSTRAINT "user_slack_integrations_slack_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_slack_integrations" DROP CONSTRAINT "user_slack_integrations_user_id_fkey";

-- AlterTable
ALTER TABLE "slack_integrations" DROP COLUMN "scope",
DROP COLUMN "user_scope";

-- AlterTable
ALTER TABLE "user_slack_integrations" DROP COLUMN "dm_channel_id";

-- AddForeignKey
ALTER TABLE "user_slack_integrations" ADD CONSTRAINT "user_slack_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_slack_integrations" ADD CONSTRAINT "user_slack_integrations_slack_team_id_fkey" FOREIGN KEY ("slack_team_id") REFERENCES "slack_integrations"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;
