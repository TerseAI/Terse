/*
  Warnings:

  - You are about to drop the column `run_state_json` on the `pending_approvals` table. All the data in the column will be lost.
  - Added the required column `interruptions` to the `pending_approvals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serialized_state` to the `pending_approvals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "RunHistoryChatEventType" ADD VALUE 'ToolApprovalResponse';

-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "require_approval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pending_approvals" DROP COLUMN "run_state_json",
ADD COLUMN     "interruptions" JSONB NOT NULL,
ADD COLUMN     "serialized_state" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "approval_slack_messages" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "slack_channel_id" TEXT NOT NULL,
    "slack_message_ts" TEXT NOT NULL,
    "user_slack_integration_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_slack_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_slack_messages_run_id_idx" ON "approval_slack_messages"("run_id");

-- CreateIndex
CREATE INDEX "approval_slack_messages_step_id_idx" ON "approval_slack_messages"("step_id");

-- CreateIndex
CREATE INDEX "approval_slack_messages_status_idx" ON "approval_slack_messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_slack_messages_run_id_step_id_key" ON "approval_slack_messages"("run_id", "step_id");

-- CreateIndex
CREATE INDEX "pending_approvals_run_history_record_id_idx" ON "pending_approvals"("run_history_record_id");
