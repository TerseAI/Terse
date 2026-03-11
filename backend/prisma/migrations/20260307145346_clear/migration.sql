/*
  Warnings:

  - You are about to drop the `directive_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `run_history_chat_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "directive_records" DROP CONSTRAINT "directive_records_automation_id_fkey";

-- DropForeignKey
ALTER TABLE "directive_records" DROP CONSTRAINT "directive_records_run_history_chat_event_id_fkey";

-- DropForeignKey
ALTER TABLE "directive_records" DROP CONSTRAINT "directive_records_run_history_record_id_fkey";

-- DropForeignKey
ALTER TABLE "run_history_chat_events" DROP CONSTRAINT "run_history_chat_events_run_history_record_id_fkey";

-- DropTable
DROP TABLE "directive_records";

-- DropTable
DROP TABLE "run_history_chat_events";
