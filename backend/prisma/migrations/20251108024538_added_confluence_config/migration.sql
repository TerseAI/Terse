-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'CONFLUENCE';

-- CreateTable
CREATE TABLE "automation_confluence_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "space_id" TEXT,
    "space_key" TEXT,
    "page_id" TEXT NOT NULL,
    "page_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_confluence_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlassian_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlassian_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_confluence_configs_automation_input_id_key" ON "automation_confluence_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_confluence_configs_automation_output_id_key" ON "automation_confluence_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_confluence_configs_space_key_idx" ON "automation_confluence_configs"("space_key");

-- CreateIndex
CREATE INDEX "automation_confluence_configs_space_id_idx" ON "automation_confluence_configs"("space_id");

-- CreateIndex
CREATE INDEX "automation_confluence_configs_page_id_idx" ON "automation_confluence_configs"("page_id");

-- AddForeignKey
ALTER TABLE "automation_confluence_configs" ADD CONSTRAINT "automation_confluence_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_confluence_configs" ADD CONSTRAINT "automation_confluence_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlassian_integrations" ADD CONSTRAINT "atlassian_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
