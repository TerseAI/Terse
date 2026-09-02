-- CreateTable
CREATE TABLE "organization_settings" (
    "organization_id" TEXT NOT NULL,
    "execution_region" TEXT NOT NULL DEFAULT 'us-east',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("organization_id"),
    CONSTRAINT "organization_settings_execution_region_check" CHECK ("execution_region" IN ('us-west', 'us-central', 'us-east'))
);

-- AlterTable
ALTER TABLE "run_history_records" ADD COLUMN "execution_region" TEXT;

ALTER TABLE "run_history_records"
ADD CONSTRAINT "run_history_records_execution_region_check"
CHECK ("execution_region" IS NULL OR "execution_region" IN ('us-west', 'us-central', 'us-east'));
