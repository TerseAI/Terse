/*
  Warnings:

  - Added the required column `type` to the `run_history_actions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RunHistoryActionType" AS ENUM ('create', 'update', 'delete', 'read');

-- AlterTable
ALTER TABLE "run_history_actions" ADD COLUMN "type" "RunHistoryActionType";

UPDATE "run_history_actions" SET "type" = 'create' WHERE "type" IS NULL;

ALTER TABLE "run_history_actions" ALTER COLUMN "type" SET NOT NULL;