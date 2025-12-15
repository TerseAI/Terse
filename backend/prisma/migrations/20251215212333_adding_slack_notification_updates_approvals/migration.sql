-- AlterEnum
ALTER TYPE "RunHistoryActionType" ADD VALUE 'approval';

-- AlterEnum
ALTER TYPE "RunHistoryChatEventType" ADD VALUE 'ToolApprovalResponse';

-- CreateTable
CREATE TABLE "approval_slack_messages" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "slack_channel_id" TEXT NOT NULL,
    "slack_message_ts" TEXT NOT NULL,
    "user_slack_integration_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
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
