-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'SNOWFLAKE';

-- AlterEnum
ALTER TYPE "OutputConfigType" ADD VALUE 'SNOWFLAKE';

-- CreateTable
CREATE TABLE "snowflake_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_identifier" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "database_name" TEXT,
    "schema_name" TEXT,
    "role_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snowflake_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_snowflake_configs" (
    "id" TEXT NOT NULL,
    "automation_output_id" TEXT NOT NULL,
    "warehouse" TEXT,
    "database_name" TEXT,
    "schema_name" TEXT,

    CONSTRAINT "automation_snowflake_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snowflake_integrations_user_id_idx" ON "snowflake_integrations"("user_id");

-- CreateIndex
CREATE INDEX "snowflake_integrations_organization_id_idx" ON "snowflake_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_snowflake_configs_automation_output_id_key" ON "automation_snowflake_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "snowflake_integrations" ADD CONSTRAINT "snowflake_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_snowflake_configs" ADD CONSTRAINT "automation_snowflake_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
