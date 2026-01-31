/*
  Warnings:

  - Made the column `organization_id` on table `atlassian_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `automations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `datadog_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `figma_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `github_app_tokens` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `gmail_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `launchdarkly_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `linear_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `notion_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `posthog_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `user_slack_integrations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "atlassian_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "automations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "datadog_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "figma_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "github_app_tokens" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "gmail_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "launchdarkly_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "linear_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "notion_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "posthog_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "user_slack_integrations" ALTER COLUMN "organization_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "atlassian_integrations_organization_id_idx" ON "atlassian_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "datadog_integrations_organization_id_idx" ON "datadog_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "figma_integrations_organization_id_idx" ON "figma_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "github_app_tokens_organization_id_idx" ON "github_app_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "gmail_integrations_organization_id_idx" ON "gmail_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "launchdarkly_integrations_organization_id_idx" ON "launchdarkly_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "linear_integrations_organization_id_idx" ON "linear_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "notion_integrations_organization_id_idx" ON "notion_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "posthog_integrations_organization_id_idx" ON "posthog_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "user_slack_integrations_organization_id_idx" ON "user_slack_integrations"("organization_id");
