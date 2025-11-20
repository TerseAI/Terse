/*
  Warnings:

  - Added the required column `config_type` to the `automation_inputs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InputConfigType" AS ENUM ('GMAIL', 'FIGMA', 'SLACK', 'NOTION_PAGE', 'NOTION_DATABASE', 'LINEAR', 'GITHUB', 'JIRA', 'CONFLUENCE');

-- AlterTable
ALTER TABLE "automation_inputs" ADD COLUMN "config_type" "InputConfigType";

UPDATE "automation_inputs" 
SET "config_type" = (
  CASE WHEN "integration_type" = 'GMAIL' THEN 'GMAIL'::"InputConfigType" 
  WHEN "integration_type" = 'FIGMA' THEN 'FIGMA'::"InputConfigType" 
  WHEN "integration_type" = 'SLACK' THEN 'SLACK'::"InputConfigType" 
  WHEN "integration_type" = 'NOTION' THEN 'NOTION_DATABASE'::"InputConfigType" 
  WHEN "integration_type" = 'NOTION_PAGE' THEN 'NOTION_PAGE'::"InputConfigType" 
  WHEN "integration_type" = 'LINEAR' THEN 'LINEAR'::"InputConfigType" 
  WHEN "integration_type" = 'GITHUB' THEN 'GITHUB'::"InputConfigType" 
  WHEN "integration_type" = 'JIRA' THEN 'JIRA'::"InputConfigType" 
  WHEN "integration_type" = 'CONFLUENCE' THEN 'CONFLUENCE'::"InputConfigType" END);

ALTER TABLE "automation_inputs" ALTER COLUMN "config_type" SET NOT NULL;
ALTER TABLE "automation_inputs" DROP COLUMN "integration_type";


