-- AlterEnum
ALTER TYPE "KnowledgeBaseConfigType" ADD VALUE 'DATADOG';

-- CreateTable
CREATE TABLE "datadog_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datadog_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_datadog_configs" (
    "id" TEXT NOT NULL,
    "automation_knowledge_base_id" TEXT NOT NULL,
    "default_indexes" TEXT[] DEFAULT ARRAY['main']::TEXT[],
    "can_read_logs" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "automation_datadog_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "datadog_integrations_user_id_idx" ON "datadog_integrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_datadog_configs_automation_knowledge_base_id_key" ON "automation_datadog_configs"("automation_knowledge_base_id");

-- CreateIndex
CREATE INDEX "automation_datadog_configs_default_indexes_idx" ON "automation_datadog_configs"("default_indexes");

-- AddForeignKey
ALTER TABLE "datadog_integrations" ADD CONSTRAINT "datadog_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_datadog_configs" ADD CONSTRAINT "automation_datadog_configs_automation_knowledge_base_id_fkey" FOREIGN KEY ("automation_knowledge_base_id") REFERENCES "automation_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
