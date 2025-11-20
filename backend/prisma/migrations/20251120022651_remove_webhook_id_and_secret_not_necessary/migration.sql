/*
  Warnings:

  - You are about to drop the column `webhook_id` on the `linear_integrations` table. All the data in the column will be lost.
  - You are about to drop the column `webhook_secret` on the `linear_integrations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "linear_integrations" DROP COLUMN "webhook_id",
DROP COLUMN "webhook_secret";
