/*
  Warnings:

  - A unique constraint covering the columns `[automation_input_id,event_type]` on the table `figma_webhooks` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."figma_webhooks_automation_input_id_key";

-- AlterTable
ALTER TABLE "figma_webhooks" ADD COLUMN     "event_type" TEXT NOT NULL DEFAULT 'FILE_UPDATE';

-- CreateIndex
CREATE INDEX "figma_webhooks_event_type_idx" ON "figma_webhooks"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "figma_webhooks_automation_input_id_event_type_key" ON "figma_webhooks"("automation_input_id", "event_type");
