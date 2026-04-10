/*
  Warnings:

  - The values [FIGMA] on the enum `InputConfigType` will be removed. If these variants are still used in the database, this will fail.
  - The values [FIGMA] on the enum `IntegrationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `automation_figma_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `figma_comment_context` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `figma_integrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `figma_webhooks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `processed_figma_comments` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InputConfigType_new" AS ENUM ('GMAIL', 'SLACK', 'NOTION_PAGE', 'NOTION_DATABASE', 'LINEAR', 'GITHUB', 'POSTHOG', 'TIME_TRIGGER', 'WORKOS_INPUT', 'WEBHOOK_INPUT');
ALTER TABLE "automation_inputs" ALTER COLUMN "config_type" TYPE "InputConfigType_new" USING ("config_type"::text::"InputConfigType_new");
ALTER TYPE "InputConfigType" RENAME TO "InputConfigType_old";
ALTER TYPE "InputConfigType_new" RENAME TO "InputConfigType";
DROP TYPE "public"."InputConfigType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "IntegrationType_new" AS ENUM ('GITHUB', 'GMAIL', 'LINEAR', 'SLACK', 'NOTION', 'NOTION_PAGE', 'TERSE', 'POSTHOG', 'CRON_JOB', 'LAUNCHDARKLY', 'DATADOG', 'WORKOS', 'ATTIO', 'SNOWFLAKE', 'WEBHOOK');
ALTER TABLE "run_history_records" ALTER COLUMN "trigger_integration" TYPE "IntegrationType_new" USING ("trigger_integration"::text::"IntegrationType_new");
ALTER TABLE "run_history_actions" ALTER COLUMN "integration" TYPE "IntegrationType_new" USING ("integration"::text::"IntegrationType_new");
ALTER TYPE "IntegrationType" RENAME TO "IntegrationType_old";
ALTER TYPE "IntegrationType_new" RENAME TO "IntegrationType";
DROP TYPE "public"."IntegrationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "automation_figma_configs" DROP CONSTRAINT "automation_figma_configs_automation_input_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_figma_configs" DROP CONSTRAINT "automation_figma_configs_automation_output_id_fkey";

-- DropForeignKey
ALTER TABLE "figma_comment_context" DROP CONSTRAINT "figma_comment_context_figma_integration_id_fkey";

-- DropForeignKey
ALTER TABLE "figma_integrations" DROP CONSTRAINT "figma_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "figma_webhooks" DROP CONSTRAINT "figma_webhooks_figma_integration_id_fkey";

-- DropForeignKey
ALTER TABLE "processed_figma_comments" DROP CONSTRAINT "processed_figma_comments_figma_integration_id_fkey";

-- DropTable
DROP TABLE "automation_figma_configs";

-- DropTable
DROP TABLE "figma_comment_context";

-- DropTable
DROP TABLE "figma_integrations";

-- DropTable
DROP TABLE "figma_webhooks";

-- DropTable
DROP TABLE "processed_figma_comments";
