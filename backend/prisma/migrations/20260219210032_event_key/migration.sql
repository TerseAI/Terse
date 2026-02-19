/*
  Warnings:

  - Made the column `event_key` on table `chat_raw_events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `event_key` on table `run_history_raw_events` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "chat_raw_events" ALTER COLUMN "event_key" SET NOT NULL;

-- AlterTable
ALTER TABLE "run_history_raw_events" ALTER COLUMN "event_key" SET NOT NULL;
