/*
  Warnings:

  - Added the required column `sequence_order` to the `run_history_raw_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "run_history_raw_events" ADD COLUMN     "sequence_order" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "run_history_raw_events_run_history_record_id_sequence_order_idx" ON "run_history_raw_events"("run_history_record_id", "sequence_order");
