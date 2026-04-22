/*
  Warnings:

  - You are about to drop the column `current_sdk_source_image_id` on the `automation_prompts` table. All the data in the column will be lost.
  - You are about to drop the column `remote_server_url` on the `automation_prompts` table. All the data in the column will be lost.
  - You are about to drop the column `signing_secret` on the `automation_prompts` table. All the data in the column will be lost.
  - You are about to drop the column `source_code_gcs_key` on the `automation_prompts` table. All the data in the column will be lost.
  - You are about to drop the column `sdk_source_image_id` on the `run_history_records` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeployStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- DropForeignKey
ALTER TABLE "automation_prompts" DROP CONSTRAINT "automation_prompts_current_sdk_source_image_id_fkey";

-- DropForeignKey
ALTER TABLE "run_history_records" DROP CONSTRAINT "run_history_records_sdk_source_image_id_fkey";

-- DropIndex
DROP INDEX "run_history_records_sdk_source_image_id_idx";

-- AlterTable
ALTER TABLE "automation_prompts" DROP COLUMN "current_sdk_source_image_id",
DROP COLUMN "remote_server_url",
DROP COLUMN "signing_secret",
DROP COLUMN "source_code_gcs_key";

-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "project_id" TEXT;

-- AlterTable
ALTER TABLE "run_history_records" DROP COLUMN "sdk_source_image_id",
ADD COLUMN     "project_deploy_id" TEXT;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "signing_secret" TEXT,
    "remote_server_url" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deploys" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sdk_source_image_id" TEXT,
    "deployed_by_user_id" TEXT NOT NULL,
    "status" "DeployStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deploys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_name_key" ON "projects"("organization_id", "name");

-- CreateIndex
CREATE INDEX "project_deploys_project_id_created_at_idx" ON "project_deploys"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "project_deploys_sdk_source_image_id_idx" ON "project_deploys"("sdk_source_image_id");

-- CreateIndex
CREATE INDEX "project_deploys_deployed_by_user_id_idx" ON "project_deploys"("deployed_by_user_id");

-- CreateIndex
CREATE INDEX "run_history_records_project_deploy_id_idx" ON "run_history_records"("project_deploy_id");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deploys" ADD CONSTRAINT "project_deploys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deploys" ADD CONSTRAINT "project_deploys_sdk_source_image_id_fkey" FOREIGN KEY ("sdk_source_image_id") REFERENCES "sdk_source_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deploys" ADD CONSTRAINT "project_deploys_deployed_by_user_id_fkey" FOREIGN KEY ("deployed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_history_records" ADD CONSTRAINT "run_history_records_project_deploy_id_fkey" FOREIGN KEY ("project_deploy_id") REFERENCES "project_deploys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
