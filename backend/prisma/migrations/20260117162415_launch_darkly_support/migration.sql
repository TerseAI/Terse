-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'LAUNCHDARKLY';

-- AlterEnum
ALTER TYPE "KnowledgeBaseConfigType" ADD VALUE 'LAUNCHDARKLY';

-- CreateTable
CREATE TABLE "launchdarkly_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "user_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchdarkly_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_launchdarkly_configs" (
    "id" TEXT NOT NULL,
    "automation_knowledge_base_id" TEXT NOT NULL,
    "project_key" TEXT NOT NULL,
    "environment_keys" TEXT[],

    CONSTRAINT "automation_launchdarkly_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launchdarkly_integrations_user_id_idx" ON "launchdarkly_integrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_launchdarkly_configs_automation_knowledge_base_i_key" ON "automation_launchdarkly_configs"("automation_knowledge_base_id");

-- CreateIndex
CREATE INDEX "automation_launchdarkly_configs_project_key_idx" ON "automation_launchdarkly_configs"("project_key");

-- AddForeignKey
ALTER TABLE "launchdarkly_integrations" ADD CONSTRAINT "launchdarkly_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_launchdarkly_configs" ADD CONSTRAINT "automation_launchdarkly_configs_automation_knowledge_base__fkey" FOREIGN KEY ("automation_knowledge_base_id") REFERENCES "automation_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
