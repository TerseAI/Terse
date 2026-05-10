/*
  Warnings:

  - A unique constraint covering the columns `[automation_input_id,webhook_id]` on the table `automation_hey_reach_configs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `webhook_id` to the `automation_hey_reach_configs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "automation_hey_reach_configs" ADD COLUMN     "webhook_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "automation_hey_reach_configs_automation_input_id_webhook_id_key" ON "automation_hey_reach_configs"("automation_input_id", "webhook_id");
