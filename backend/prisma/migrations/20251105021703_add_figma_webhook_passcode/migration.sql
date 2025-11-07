/*
  Warnings:

  - Added the required column `passcode` to the `figma_webhooks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "figma_webhooks" ADD COLUMN     "passcode" TEXT NOT NULL;
