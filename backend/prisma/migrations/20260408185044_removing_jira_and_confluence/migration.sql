/*
  Warnings:

  - The values [JIRA,CONFLUENCE] on the enum `InputConfigType` will be removed. If these variants are still used in the database, this will fail.
  - The values [JIRA,CONFLUENCE] on the enum `IntegrationType` will be removed. If these variants are still used in the database, this will fail.
  - The values [JIRA_TICKET] on the enum `OutputConfigType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `atlassian_integrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_confluence_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_jira_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InputConfigType_new" AS ENUM ('GMAIL', 'FIGMA', 'SLACK', 'NOTION_PAGE', 'NOTION_DATABASE', 'LINEAR', 'GITHUB', 'POSTHOG', 'TIME_TRIGGER', 'WORKOS_INPUT', 'WEBHOOK_INPUT');
ALTER TABLE "automation_inputs" ALTER COLUMN "config_type" TYPE "InputConfigType_new" USING ("config_type"::text::"InputConfigType_new");
ALTER TYPE "InputConfigType" RENAME TO "InputConfigType_old";
ALTER TYPE "InputConfigType_new" RENAME TO "InputConfigType";
DROP TYPE "public"."InputConfigType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "IntegrationType_new" AS ENUM ('GITHUB', 'GMAIL', 'LINEAR', 'SLACK', 'NOTION', 'NOTION_PAGE', 'FIGMA', 'TERSE', 'POSTHOG', 'CRON_JOB', 'LAUNCHDARKLY', 'DATADOG', 'WORKOS', 'ATTIO', 'SNOWFLAKE', 'WEBHOOK');
ALTER TABLE "run_history_records" ALTER COLUMN "trigger_integration" TYPE "IntegrationType_new" USING ("trigger_integration"::text::"IntegrationType_new");
ALTER TABLE "run_history_actions" ALTER COLUMN "integration" TYPE "IntegrationType_new" USING ("integration"::text::"IntegrationType_new");
ALTER TYPE "IntegrationType" RENAME TO "IntegrationType_old";
ALTER TYPE "IntegrationType_new" RENAME TO "IntegrationType";
DROP TYPE "public"."IntegrationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OutputConfigType_new" AS ENUM ('NOTION', 'CONFLUENCE', 'LINEAR_TICKET', 'SLACK_CHANNEL', 'GMAIL', 'GMAIL_DRAFT', 'TERSE', 'ATTIO', 'GITHUB', 'POSTHOG', 'LAUNCHDARKLY', 'DATADOG', 'WORKOS', 'SNOWFLAKE');
ALTER TABLE "automation_outputs" ALTER COLUMN "config_type" TYPE "OutputConfigType_new" USING ("config_type"::text::"OutputConfigType_new");
ALTER TABLE "output_change_attributions" ALTER COLUMN "output_item_type" TYPE "OutputConfigType_new" USING ("output_item_type"::text::"OutputConfigType_new");
ALTER TYPE "OutputConfigType" RENAME TO "OutputConfigType_old";
ALTER TYPE "OutputConfigType_new" RENAME TO "OutputConfigType";
DROP TYPE "public"."OutputConfigType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "atlassian_integrations" DROP CONSTRAINT "atlassian_integrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_confluence_configs" DROP CONSTRAINT "automation_confluence_configs_automation_input_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_confluence_configs" DROP CONSTRAINT "automation_confluence_configs_automation_output_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_jira_configs" DROP CONSTRAINT "automation_jira_configs_automation_input_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_jira_configs" DROP CONSTRAINT "automation_jira_configs_automation_output_id_fkey";

-- DropTable
DROP TABLE "atlassian_integrations";

-- DropTable
DROP TABLE "automation_confluence_configs";

-- DropTable
DROP TABLE "automation_jira_configs";
