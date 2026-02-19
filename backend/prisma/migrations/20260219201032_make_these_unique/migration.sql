/*
  Warnings:

  - A unique constraint covering the columns `[event_key]` on the table `chat_raw_events` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[event_key]` on the table `run_history_raw_events` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `event_key` to the `chat_raw_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `event_key` to the `run_history_raw_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chat_raw_events" ADD COLUMN     "event_key" TEXT;

-- AlterTable
ALTER TABLE "run_history_raw_events" ADD COLUMN     "event_key" TEXT;