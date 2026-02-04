-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KnowledgeBaseConfigType" ADD VALUE 'LINEAR';
ALTER TYPE "KnowledgeBaseConfigType" ADD VALUE 'SLACK';

-- CreateTable
CREATE TABLE "automation_linear_kb_configs" (
    "id" TEXT NOT NULL,
    "automation_knowledge_base_id" TEXT NOT NULL,
    "team_id" TEXT,
    "team_name" TEXT,
    "project_id" TEXT,
    "project_name" TEXT,

    CONSTRAINT "automation_linear_kb_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_slack_kb_configs" (
    "id" TEXT NOT NULL,
    "automation_knowledge_base_id" TEXT NOT NULL,
    "channel_ids" TEXT[],
    "channel_names" TEXT[],
    "allow_dms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "automation_slack_kb_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_linear_kb_configs_automation_knowledge_base_id_key" ON "automation_linear_kb_configs"("automation_knowledge_base_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_slack_kb_configs_automation_knowledge_base_id_key" ON "automation_slack_kb_configs"("automation_knowledge_base_id");

-- AddForeignKey
ALTER TABLE "automation_linear_kb_configs" ADD CONSTRAINT "automation_linear_kb_configs_automation_knowledge_base_id_fkey" FOREIGN KEY ("automation_knowledge_base_id") REFERENCES "automation_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_slack_kb_configs" ADD CONSTRAINT "automation_slack_kb_configs_automation_knowledge_base_id_fkey" FOREIGN KEY ("automation_knowledge_base_id") REFERENCES "automation_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
