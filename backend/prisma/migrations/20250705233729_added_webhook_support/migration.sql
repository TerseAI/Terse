/*
  Warnings:

  - Added the required column `webhook_id` to the `linear_api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `webhook_secret` to the `linear_api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "linear_api_keys" ADD COLUMN     "webhook_id" TEXT NOT NULL,
ADD COLUMN     "webhook_secret" TEXT NOT NULL;
