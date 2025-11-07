/*
  Warnings:

  - You are about to drop the column `email` on the `figma_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `automation_input_id` on the `figma_webhooks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "figma_integrations" DROP COLUMN "email";

-- AlterTable
ALTER TABLE "figma_webhooks" DROP COLUMN "automation_input_id";
