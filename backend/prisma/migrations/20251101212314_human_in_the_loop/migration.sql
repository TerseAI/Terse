/*
  Warnings:

  - You are about to drop the column `search_fts` on the `run_history_actions` table. All the data in the column will be lost.
  - You are about to drop the column `search_fts` on the `run_history_records` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "RunHistoryStatus" ADD VALUE 'awaiting_approval';

-- CreateTable
CREATE TABLE "pending_approvals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "run_history_record_id" TEXT NOT NULL,
    "run_state_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT now() + interval '24 hours',

    CONSTRAINT "pending_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_approvals_run_history_record_id_key" ON "pending_approvals"("run_history_record_id");

-- CreateIndex
CREATE INDEX "pending_approvals_user_id_idx" ON "pending_approvals"("user_id");

-- CreateIndex
CREATE INDEX "pending_approvals_created_at_idx" ON "pending_approvals"("created_at");

-- AddForeignKey
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_run_history_record_id_fkey" FOREIGN KEY ("run_history_record_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
