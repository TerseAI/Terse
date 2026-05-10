-- AlterEnum
ALTER TYPE "InputConfigType" ADD VALUE 'HEY_REACH_INPUT';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'HEY_REACH';

-- CreateTable
CREATE TABLE "hey_reach_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hey_reach_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_hey_reach_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "event_types" TEXT[],
    "campaign_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_hey_reach_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hey_reach_integrations_organization_id_idx" ON "hey_reach_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_hey_reach_configs_automation_input_id_key" ON "automation_hey_reach_configs"("automation_input_id");

-- AddForeignKey
ALTER TABLE "automation_hey_reach_configs" ADD CONSTRAINT "automation_hey_reach_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
