/*
  Warnings:

  - You are about to drop the column `file_key` on the `figma_webhooks` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[figma_integration_id,team_id,event_type]` on the table `figma_webhooks` will be added. If there are existing duplicate values, this will fail.
  - Made the column `team_id` on table `figma_webhooks` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."figma_webhooks_automation_input_id_event_type_key";

-- DropIndex
DROP INDEX "public"."figma_webhooks_file_key_idx";

-- AlterTable
ALTER TABLE "figma_webhooks" DROP COLUMN "file_key",
ALTER COLUMN "automation_input_id" DROP NOT NULL,
ALTER COLUMN "team_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "figma_webhooks_team_id_idx" ON "figma_webhooks"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "figma_webhooks_figma_integration_id_team_id_event_type_key" ON "figma_webhooks"("figma_integration_id", "team_id", "event_type");
