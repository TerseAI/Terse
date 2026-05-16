-- AlterEnum
ALTER TYPE "InputConfigType" ADD VALUE 'ATTIO_INPUT';

-- CreateTable
CREATE TABLE "automation_attio_input_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_attio_input_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_attio_input_configs_automation_input_id_key" ON "automation_attio_input_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_attio_input_configs_automation_input_id_webhook__key" ON "automation_attio_input_configs"("automation_input_id", "webhook_id");

-- AddForeignKey
ALTER TABLE "automation_attio_input_configs" ADD CONSTRAINT "automation_attio_input_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
