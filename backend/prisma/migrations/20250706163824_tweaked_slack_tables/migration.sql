/*
  Warnings:

  - The primary key for the `slack_integrations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `authed_user_id` on the `slack_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `slack_integrations` table. All the data in the column will be lost.
  - The required column `id` was added to the `slack_integrations` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "slack_integrations" DROP CONSTRAINT "slack_integrations_user_id_fkey";

-- AlterTable
ALTER TABLE "slack_integrations" DROP CONSTRAINT "slack_integrations_pkey",
DROP COLUMN "authed_user_id",
DROP COLUMN "user_id",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "user_slack_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "authed_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_slack_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_slack_integrations_user_id_slack_team_id_key" ON "user_slack_integrations"("user_id", "slack_team_id");

-- AddForeignKey
ALTER TABLE "user_slack_integrations" ADD CONSTRAINT "user_slack_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_slack_integrations" ADD CONSTRAINT "user_slack_integrations_slack_team_id_fkey" FOREIGN KEY ("slack_team_id") REFERENCES "slack_integrations"("app_id") ON DELETE RESTRICT ON UPDATE CASCADE;
