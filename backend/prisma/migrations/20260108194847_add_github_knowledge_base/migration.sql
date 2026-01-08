-- AlterEnum
ALTER TYPE "KnowledgeBaseConfigType" ADD VALUE 'GITHUB';

-- CreateTable
CREATE TABLE "automation_github_kb_configs" (
    "id" TEXT NOT NULL,
    "automation_knowledge_base_id" TEXT NOT NULL,
    "repository_ids" INTEGER[],
    "repository_names" TEXT[],

    CONSTRAINT "automation_github_kb_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_github_kb_configs_automation_knowledge_base_id_key" ON "automation_github_kb_configs"("automation_knowledge_base_id");

-- AddForeignKey
ALTER TABLE "automation_github_kb_configs" ADD CONSTRAINT "automation_github_kb_configs_automation_knowledge_base_id_fkey" FOREIGN KEY ("automation_knowledge_base_id") REFERENCES "automation_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
