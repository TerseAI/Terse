/*
  Warnings:

  - You are about to drop the column `automation_knowledge_base_id` on the `automation_datadog_configs` table. All the data in the column will be lost.
  - You are about to drop the column `automation_knowledge_base_id` on the `automation_launchdarkly_configs` table. All the data in the column will be lost.
  - You are about to drop the column `automation_knowledge_base_id` on the `automation_posthog_configs` table. All the data in the column will be lost.
  - You are about to drop the `automation_github_kb_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_knowledge_bases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_linear_kb_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_slack_kb_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `automation_workos_kb_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "automation_datadog_configs" DROP CONSTRAINT "automation_datadog_configs_automation_knowledge_base_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_github_kb_configs" DROP CONSTRAINT "automation_github_kb_configs_automation_knowledge_base_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_knowledge_bases" DROP CONSTRAINT "automation_knowledge_bases_automation_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_launchdarkly_configs" DROP CONSTRAINT "automation_launchdarkly_configs_automation_knowledge_base__fkey";

-- DropForeignKey
ALTER TABLE "automation_linear_kb_configs" DROP CONSTRAINT "automation_linear_kb_configs_automation_knowledge_base_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_posthog_configs" DROP CONSTRAINT "automation_posthog_configs_automation_knowledge_base_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_slack_kb_configs" DROP CONSTRAINT "automation_slack_kb_configs_automation_knowledge_base_id_fkey";

-- DropForeignKey
ALTER TABLE "automation_workos_kb_configs" DROP CONSTRAINT "automation_workos_kb_configs_automation_knowledge_base_id_fkey";

-- DropIndex
DROP INDEX "automation_datadog_configs_automation_knowledge_base_id_key";

-- DropIndex
DROP INDEX "automation_launchdarkly_configs_automation_knowledge_base_i_key";

-- DropIndex
DROP INDEX "automation_posthog_configs_automation_knowledge_base_id_key";

-- AlterTable
ALTER TABLE "automation_datadog_configs" DROP COLUMN "automation_knowledge_base_id";

-- AlterTable
ALTER TABLE "automation_launchdarkly_configs" DROP COLUMN "automation_knowledge_base_id";

-- AlterTable
ALTER TABLE "automation_posthog_configs" DROP COLUMN "automation_knowledge_base_id";

-- DropTable
DROP TABLE "automation_github_kb_configs";

-- DropTable
DROP TABLE "automation_knowledge_bases";

-- DropTable
DROP TABLE "automation_linear_kb_configs";

-- DropTable
DROP TABLE "automation_slack_kb_configs";

-- DropTable
DROP TABLE "automation_workos_kb_configs";
