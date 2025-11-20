/*
  Warnings:

  - Added the required column `cloud_id` to the `atlassian_integrations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "atlassian_integrations" ADD COLUMN     "cloud_id" TEXT NOT NULL,
ADD COLUMN     "webhook_secret" TEXT;
