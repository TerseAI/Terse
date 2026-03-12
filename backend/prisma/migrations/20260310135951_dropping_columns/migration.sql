/*
  Warnings:

  - You are about to drop the column `access_token` on the `atlassian_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `atlassian_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `webhook_secret` on the `atlassian_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `attio_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `api_key` on the `datadog_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `app_key` on the `datadog_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `figma_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `figma_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `github_app_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `github_app_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `gmail_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `gmail_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `api_key` on the `launchdarkly_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `linear_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `linear_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `integration_token` on the `notion_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `api_key` on the `posthog_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `slack_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `authed_user_access_token` on the `user_slack_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `api_key` on the `workos_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `webhook_secret` on the `workos_integrations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "atlassian_integrations" DROP COLUMN "access_token",
DROP COLUMN "refresh_token",
DROP COLUMN "webhook_secret";

-- AlterTable
ALTER TABLE "attio_integrations" DROP COLUMN "access_token";

-- AlterTable
ALTER TABLE "datadog_integrations" DROP COLUMN "api_key",
DROP COLUMN "app_key";

-- AlterTable
ALTER TABLE "figma_integrations" DROP COLUMN "access_token",
DROP COLUMN "refresh_token";

-- AlterTable
ALTER TABLE "github_app_tokens" DROP COLUMN "access_token",
DROP COLUMN "refresh_token";

-- AlterTable
ALTER TABLE "gmail_integrations" DROP COLUMN "access_token",
DROP COLUMN "refresh_token";

-- AlterTable
ALTER TABLE "launchdarkly_integrations" DROP COLUMN "api_key";

-- AlterTable
ALTER TABLE "linear_integrations" DROP COLUMN "access_token",
DROP COLUMN "refresh_token";

-- AlterTable
ALTER TABLE "notion_integrations" DROP COLUMN "integration_token";

-- AlterTable
ALTER TABLE "posthog_integrations" DROP COLUMN "api_key";

-- AlterTable
ALTER TABLE "slack_integrations" DROP COLUMN "access_token";

-- AlterTable
ALTER TABLE "user_slack_integrations" DROP COLUMN "authed_user_access_token";

-- AlterTable
ALTER TABLE "workos_integrations" DROP COLUMN "api_key",
DROP COLUMN "webhook_secret";
