/*
  Warnings:

  - You are about to drop the column `integration_type` on the `automation_outputs` table. All the data in the column will be lost.
  - Added the required column `output_type` to the `automation_outputs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OutputConfigType" AS ENUM ('NOTION_PAGE', 'NOTION_DATABASE', 'CONFLUENCE');

-- DropIndex
DROP INDEX "automation_outputs_integration_type_integration_id_idx";

ALTER TABLE "automation_outputs" ADD COLUMN "config_type" "OutputConfigType";

UPDATE "automation_outputs" 
SET "config_type" = (
  CASE WHEN "integration_type" = 'NOTION_PAGE' THEN 'NOTION_PAGE'::"OutputConfigType" 
  WHEN "integration_type" = 'NOTION' THEN 'NOTION_DATABASE'::"OutputConfigType" 
  WHEN "integration_type" = 'CONFLUENCE' THEN 'CONFLUENCE'::"OutputConfigType" 
END);

-- AlterTable
ALTER TABLE "automation_outputs" DROP COLUMN "integration_type";
ALTER TABLE "automation_outputs" ALTER COLUMN "config_type" SET NOT NULL;

-- CreateIndex
CREATE INDEX "automation_outputs_config_type_integration_id_idx" ON "automation_outputs"("config_type", "integration_id");
