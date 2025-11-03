/*
  Warnings:

  - You are about to drop the column `expires_at` on the `pending_approvals` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pending_approvals" DROP COLUMN "expires_at";
