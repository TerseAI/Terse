/*
  Warnings:

  - Changed the type of `webhook_id` on the `automation_hey_reach_configs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "automation_hey_reach_configs" DROP COLUMN "webhook_id",
ADD COLUMN     "webhook_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "automation_hey_reach_configs_automation_input_id_webhook_id_key" ON "automation_hey_reach_configs"("automation_input_id", "webhook_id");
