-- AlterEnum
ALTER TYPE "InputConfigType" ADD VALUE 'WORKOS_INPUT';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'WORKOS';

-- CreateTable
CREATE TABLE "workos_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "organization_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workos_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_workos_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "event_types" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_workos_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workos_integrations_user_id_idx" ON "workos_integrations"("user_id");

-- CreateIndex
CREATE INDEX "workos_integrations_organization_id_idx" ON "workos_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_workos_configs_automation_input_id_key" ON "automation_workos_configs"("automation_input_id");

-- AddForeignKey
ALTER TABLE "workos_integrations" ADD CONSTRAINT "workos_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_workos_configs" ADD CONSTRAINT "automation_workos_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
