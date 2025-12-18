-- CreateEnum
CREATE TYPE "KnowledgeBaseConfigType" AS ENUM ('POSTHOG');

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'POSTHOG';

-- CreateTable
CREATE TABLE "posthog_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posthog_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_knowledge_bases" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "config_type" "KnowledgeBaseConfigType" NOT NULL,
    "integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_posthog_configs" (
    "id" TEXT NOT NULL,
    "automation_knowledge_base_id" TEXT NOT NULL,

    CONSTRAINT "automation_posthog_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posthog_integrations_user_id_idx" ON "posthog_integrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_knowledge_bases_automation_id_key" ON "automation_knowledge_bases"("automation_id");

-- CreateIndex
CREATE INDEX "automation_knowledge_bases_config_type_integration_id_idx" ON "automation_knowledge_bases"("config_type", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_posthog_configs_automation_knowledge_base_id_key" ON "automation_posthog_configs"("automation_knowledge_base_id");

-- AddForeignKey
ALTER TABLE "posthog_integrations" ADD CONSTRAINT "posthog_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_knowledge_bases" ADD CONSTRAINT "automation_knowledge_bases_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_posthog_configs" ADD CONSTRAINT "automation_posthog_configs_automation_knowledge_base_id_fkey" FOREIGN KEY ("automation_knowledge_base_id") REFERENCES "automation_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
