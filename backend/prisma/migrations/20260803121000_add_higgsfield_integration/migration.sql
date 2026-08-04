-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'HIGGSFIELD';

-- AlterEnum
ALTER TYPE "OutputConfigType" ADD VALUE 'HIGGSFIELD';

-- CreateTable
CREATE TABLE "higgsfield_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "higgsfield_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "higgsfield_integrations_organization_id_idx" ON "higgsfield_integrations"("organization_id");

-- CreateTable
CREATE TABLE "automation_higgsfield_configs" (
    "id" TEXT NOT NULL,
    "automation_output_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_higgsfield_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_higgsfield_configs_automation_output_id_key" ON "automation_higgsfield_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "automation_higgsfield_configs" ADD CONSTRAINT "automation_higgsfield_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
