/*
  Warnings:

  - You are about to drop the column `usersId` on the `pending_approvals` table. All the data in the column will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "api_tokens" DROP CONSTRAINT "api_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "attio_integrations" DROP CONSTRAINT "attio_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "automations" DROP CONSTRAINT "automations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "datadog_integrations" DROP CONSTRAINT "datadog_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "github_app_tokens" DROP CONSTRAINT "github_app_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "gmail_integrations" DROP CONSTRAINT "gmail_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "launchdarkly_integrations" DROP CONSTRAINT "launchdarkly_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "linear_integrations" DROP CONSTRAINT "linear_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notion_integrations" DROP CONSTRAINT "notion_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "pending_approvals" DROP CONSTRAINT "pending_approvals_usersId_fkey";

-- DropForeignKey
ALTER TABLE "posthog_integrations" DROP CONSTRAINT "posthog_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "project_deploys" DROP CONSTRAINT "project_deploys_deployed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "snowflake_integrations" DROP CONSTRAINT "snowflake_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_notification_destinations" DROP CONSTRAINT "user_notification_destinations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_notification_settings" DROP CONSTRAINT "user_notification_settings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_slack_integrations" DROP CONSTRAINT "user_slack_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "workos_integrations" DROP CONSTRAINT "workos_integrations_user_id_fkey";

-- Rewrite every FK value from users.id (cuid) to users.workos_id, so the
-- column carries the identity used by every downstream auth path after the
-- users table is dropped.
UPDATE "api_tokens"                     SET "user_id" = u."workos_id" FROM "users" u WHERE "api_tokens"."user_id" = u."id";
UPDATE "attio_integrations"             SET "user_id" = u."workos_id" FROM "users" u WHERE "attio_integrations"."user_id" = u."id";
UPDATE "automations"                    SET "user_id" = u."workos_id" FROM "users" u WHERE "automations"."user_id" = u."id";
UPDATE "datadog_integrations"           SET "user_id" = u."workos_id" FROM "users" u WHERE "datadog_integrations"."user_id" = u."id";
UPDATE "github_app_tokens"              SET "user_id" = u."workos_id" FROM "users" u WHERE "github_app_tokens"."user_id" = u."id";
UPDATE "gmail_integrations"             SET "user_id" = u."workos_id" FROM "users" u WHERE "gmail_integrations"."user_id" = u."id";
UPDATE "launchdarkly_integrations"      SET "user_id" = u."workos_id" FROM "users" u WHERE "launchdarkly_integrations"."user_id" = u."id";
UPDATE "linear_integrations"            SET "user_id" = u."workos_id" FROM "users" u WHERE "linear_integrations"."user_id" = u."id";
UPDATE "notion_integrations"            SET "user_id" = u."workos_id" FROM "users" u WHERE "notion_integrations"."user_id" = u."id";
UPDATE "posthog_integrations"           SET "user_id" = u."workos_id" FROM "users" u WHERE "posthog_integrations"."user_id" = u."id";
UPDATE "project_deploys"                SET "deployed_by_user_id" = u."workos_id" FROM "users" u WHERE "project_deploys"."deployed_by_user_id" = u."id";
UPDATE "snowflake_integrations"         SET "user_id" = u."workos_id" FROM "users" u WHERE "snowflake_integrations"."user_id" = u."id";
UPDATE "user_notification_destinations" SET "user_id" = u."workos_id" FROM "users" u WHERE "user_notification_destinations"."user_id" = u."id";
UPDATE "user_notification_settings"     SET "user_id" = u."workos_id" FROM "users" u WHERE "user_notification_settings"."user_id" = u."id";
UPDATE "user_slack_integrations"        SET "user_id" = u."workos_id" FROM "users" u WHERE "user_slack_integrations"."user_id" = u."id";
UPDATE "workos_integrations"            SET "user_id" = u."workos_id" FROM "users" u WHERE "workos_integrations"."user_id" = u."id";

-- AlterTable
ALTER TABLE "pending_approvals" DROP COLUMN "usersId";

-- DropTable
DROP TABLE "users";
