/*
  Warnings:

  - A unique constraint covering the columns `[team_id]` on the table `slack_integrations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "user_slack_integrations" DROP CONSTRAINT "user_slack_integrations_slack_team_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_team_id_key" ON "slack_integrations"("team_id");

-- AddForeignKey
ALTER TABLE "user_slack_integrations" ADD CONSTRAINT "user_slack_integrations_slack_team_id_fkey" FOREIGN KEY ("slack_team_id") REFERENCES "slack_integrations"("team_id") ON DELETE RESTRICT ON UPDATE CASCADE;
