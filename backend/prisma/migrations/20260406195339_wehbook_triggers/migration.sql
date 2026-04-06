-- AlterEnum
ALTER TYPE "InputConfigType" ADD VALUE 'WEBHOOK_INPUT';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'WEBHOOK';

-- CreateTable
CREATE TABLE "automation_webhook_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "webhook_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_webhook_configs_automation_input_id_key" ON "automation_webhook_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_webhook_configs_webhook_token_key" ON "automation_webhook_configs"("webhook_token");

-- CreateIndex
CREATE INDEX "automation_webhook_configs_webhook_token_idx" ON "automation_webhook_configs"("webhook_token");

-- AddForeignKey
ALTER TABLE "automation_webhook_configs" ADD CONSTRAINT "automation_webhook_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
