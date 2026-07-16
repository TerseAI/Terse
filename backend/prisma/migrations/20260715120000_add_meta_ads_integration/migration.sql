-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'META_ADS';

-- AlterEnum
ALTER TYPE "OutputConfigType" ADD VALUE 'META_ADS';

-- CreateTable
CREATE TABLE "meta_ads_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ads_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_meta_ads_configs" (
    "id" TEXT NOT NULL,
    "automation_output_id" TEXT NOT NULL,
    "ad_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_meta_ads_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_ads_integrations_user_id_idx" ON "meta_ads_integrations"("user_id");

-- CreateIndex
CREATE INDEX "meta_ads_integrations_organization_id_idx" ON "meta_ads_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_meta_ads_configs_automation_output_id_key" ON "automation_meta_ads_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "automation_meta_ads_configs" ADD CONSTRAINT "automation_meta_ads_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

