-- AlterTable
ALTER TABLE "automations" ADD COLUMN "consecutive_failures" INTEGER NOT NULL DEFAULT 0;
