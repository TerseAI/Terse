/*
  Warnings:

  - Made the column `refresh_token` on table `figma_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `figma_integrations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `automation_input_id` on table `figma_webhooks` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "figma_integrations" ALTER COLUMN "refresh_token" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "figma_webhooks" ALTER COLUMN "automation_input_id" SET NOT NULL;
