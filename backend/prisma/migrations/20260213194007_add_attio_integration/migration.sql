-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'ATTIO';

-- AlterEnum
ALTER TYPE "OutputConfigType" ADD VALUE 'ATTIO';

-- CreateTable
CREATE TABLE "attio_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "workspace_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attio_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_attio_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "object_slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_attio_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attio_integrations_user_id_idx" ON "attio_integrations"("user_id");

-- CreateIndex
CREATE INDEX "attio_integrations_organization_id_idx" ON "attio_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_attio_configs_automation_input_id_key" ON "automation_attio_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_attio_configs_automation_output_id_key" ON "automation_attio_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "attio_integrations" ADD CONSTRAINT "attio_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_attio_configs" ADD CONSTRAINT "automation_attio_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_attio_configs" ADD CONSTRAINT "automation_attio_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
