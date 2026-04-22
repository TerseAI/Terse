-- AlterTable: remove query, frequency, and output_schema columns from automation_webmonitor_configs
-- These fields are now owned by Parallel API and rehydrated at runtime via GET /v1alpha/monitors/{monitorId}
ALTER TABLE "automation_webmonitor_configs" DROP COLUMN "frequency_number",
DROP COLUMN "frequency_unit",
DROP COLUMN "output_schema",
DROP COLUMN "query";

-- DropEnum
DROP TYPE "FrequencyUnit";
