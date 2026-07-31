-- AlterEnum
ALTER TYPE "OutputConfigType" ADD VALUE 'GOOGLE_SEARCH_CONSOLE';

-- CreateTable
CREATE TABLE "automation_google_search_console_configs" (
    "id" TEXT NOT NULL,
    "automation_output_id" TEXT NOT NULL,
    "site_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_google_search_console_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_google_search_console_configs_automation_output__key" ON "automation_google_search_console_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "automation_google_search_console_configs" ADD CONSTRAINT "automation_google_search_console_configs_automation_output_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
