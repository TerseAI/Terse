/*
  Warnings:

  - You are about to drop the column `user_id` on the `pending_approvals` table. All the data in the column will be lost.
  - You are about to drop the `activity_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_activity_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sub_activity_commit_associations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sub_activity_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_activity_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_github_repository_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "pending_approvals" DROP CONSTRAINT "pending_approvals_user_id_fkey";

-- DropForeignKey
ALTER TABLE "project_activity_events" DROP CONSTRAINT "project_activity_events_activity_event_id_fkey";

-- DropForeignKey
ALTER TABLE "project_activity_events" DROP CONSTRAINT "project_activity_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_activity_commit_associations" DROP CONSTRAINT "sub_activity_commit_associations_sub_activity_event_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_activity_events" DROP CONSTRAINT "sub_activity_events_activity_event_id_fkey";

-- DropForeignKey
ALTER TABLE "ticket_activity_events" DROP CONSTRAINT "ticket_activity_events_activity_event_id_fkey";

-- DropForeignKey
ALTER TABLE "ticket_activity_events" DROP CONSTRAINT "ticket_activity_events_user_id_fkey";

-- DropIndex
DROP INDEX "pending_approvals_user_id_idx";

-- AlterTable
ALTER TABLE "atlassian_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "datadog_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "figma_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "github_app_tokens" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "gmail_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "launchdarkly_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "linear_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "notion_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "pending_approvals" DROP COLUMN "user_id",
ADD COLUMN     "usersId" TEXT;

-- AlterTable
ALTER TABLE "posthog_integrations" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "user_slack_integrations" ADD COLUMN     "organization_id" TEXT;

-- DropTable
DROP TABLE "activity_events";

-- DropTable
DROP TABLE "project_activity_events";

-- DropTable
DROP TABLE "sub_activity_commit_associations";

-- DropTable
DROP TABLE "sub_activity_events";

-- DropTable
DROP TABLE "ticket_activity_events";

-- DropEnum
DROP TYPE "TicketEventType";

-- CreateIndex
CREATE INDEX "automations_organization_id_idx" ON "automations"("organization_id");

-- AddForeignKey
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_usersId_fkey" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
