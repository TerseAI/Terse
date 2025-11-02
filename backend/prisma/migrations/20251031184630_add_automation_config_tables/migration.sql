/*
  Warnings:

  - You are about to drop the column `search_fts` on the `run_history_actions` table. All the data in the column will be lost.
  - You are about to drop the column `search_fts` on the `run_history_records` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."idx_run_history_actions_search_fts";

-- DropIndex
DROP INDEX "public"."idx_run_history_records_search_fts";

-- AlterTable
ALTER TABLE "run_history_actions" DROP COLUMN "search_fts";

-- AlterTable
ALTER TABLE "run_history_records" DROP COLUMN "search_fts";

-- CreateTable
CREATE TABLE "automation_slack_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "channel_id" TEXT,
    "channel_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_slack_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_notion_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "database_id" TEXT,
    "database_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_notion_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_linear_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "project_id" TEXT,
    "project_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_linear_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_jira_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "project_key" TEXT,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_jira_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_github_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "repository_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_github_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_gmail_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_gmail_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_slack_configs_automation_input_id_key" ON "automation_slack_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_slack_configs_automation_output_id_key" ON "automation_slack_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_slack_configs_channel_id_idx" ON "automation_slack_configs"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_notion_configs_automation_input_id_key" ON "automation_notion_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_notion_configs_automation_output_id_key" ON "automation_notion_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_notion_configs_database_id_idx" ON "automation_notion_configs"("database_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_linear_configs_automation_input_id_key" ON "automation_linear_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_linear_configs_automation_output_id_key" ON "automation_linear_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_linear_configs_project_id_idx" ON "automation_linear_configs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_jira_configs_automation_input_id_key" ON "automation_jira_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_jira_configs_automation_output_id_key" ON "automation_jira_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_jira_configs_project_key_idx" ON "automation_jira_configs"("project_key");

-- CreateIndex
CREATE INDEX "automation_jira_configs_project_id_idx" ON "automation_jira_configs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_github_configs_automation_input_id_key" ON "automation_github_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_github_configs_automation_output_id_key" ON "automation_github_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_github_configs_repository_id_idx" ON "automation_github_configs"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_gmail_configs_automation_input_id_key" ON "automation_gmail_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_gmail_configs_automation_output_id_key" ON "automation_gmail_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "automation_slack_configs" ADD CONSTRAINT "automation_slack_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_slack_configs" ADD CONSTRAINT "automation_slack_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_notion_configs" ADD CONSTRAINT "automation_notion_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_notion_configs" ADD CONSTRAINT "automation_notion_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_linear_configs" ADD CONSTRAINT "automation_linear_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_linear_configs" ADD CONSTRAINT "automation_linear_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jira_configs" ADD CONSTRAINT "automation_jira_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jira_configs" ADD CONSTRAINT "automation_jira_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_github_configs" ADD CONSTRAINT "automation_github_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_github_configs" ADD CONSTRAINT "automation_github_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_gmail_configs" ADD CONSTRAINT "automation_gmail_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_gmail_configs" ADD CONSTRAINT "automation_gmail_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
