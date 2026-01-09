-- AlterEnum
ALTER TYPE "InputConfigType" ADD VALUE 'TIME_TRIGGER';

-- CreateTable
CREATE TABLE "automation_time_trigger_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_time_trigger_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_time_trigger_configs_automation_input_id_key" ON "automation_time_trigger_configs"("automation_input_id");

-- AddForeignKey
ALTER TABLE "automation_time_trigger_configs" ADD CONSTRAINT "automation_time_trigger_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
