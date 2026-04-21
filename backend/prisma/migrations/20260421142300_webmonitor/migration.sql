-- CreateEnum
CREATE TYPE "FrequencyUnit" AS ENUM ('hour', 'day', 'week');

-- AlterEnum
ALTER TYPE "InputConfigType" ADD VALUE 'WEBMONITOR';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'WEBMONITOR';

-- CreateTable
CREATE TABLE "automation_webmonitor_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "frequency_number" INTEGER NOT NULL,
    "frequency_unit" "FrequencyUnit" NOT NULL,
    "provider_monitor_id" TEXT,
    "output_schema" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_webmonitor_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webmonitor_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webmonitor_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_webmonitor_configs_automation_input_id_key" ON "automation_webmonitor_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "webmonitor_webhook_deliveries_webhook_id_key" ON "webmonitor_webhook_deliveries"("webhook_id");

-- AddForeignKey
ALTER TABLE "automation_webmonitor_configs" ADD CONSTRAINT "automation_webmonitor_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
