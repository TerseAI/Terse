-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'NOTION_PAGE';

-- CreateTable
CREATE TABLE "automation_notion_page_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "page_id" TEXT NOT NULL,
    "page_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_notion_page_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_notion_page_configs_automation_input_id_key" ON "automation_notion_page_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_notion_page_configs_automation_output_id_key" ON "automation_notion_page_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_notion_page_configs_page_id_idx" ON "automation_notion_page_configs"("page_id");

-- AddForeignKey
ALTER TABLE "automation_notion_page_configs" ADD CONSTRAINT "automation_notion_page_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_notion_page_configs" ADD CONSTRAINT "automation_notion_page_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
