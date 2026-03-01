-- CreateEnum
CREATE TYPE "SentNotificationEventType" AS ENUM ('run_notification', 'approval_request', 'run_failure');

-- CreateEnum
CREATE TYPE "SentNotificationStatus" AS ENUM ('sent', 'failed');

-- CreateTable
CREATE TABLE "sent_notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "automation_id" TEXT,
    "run_id" TEXT,
    "event_type" "SentNotificationEventType" NOT NULL,
    "destination_type" "NotificationDestinationType" NOT NULL,
    "destination_label" TEXT NOT NULL,
    "status" "SentNotificationStatus" NOT NULL,
    "error_message" TEXT,
    "agent_name" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_notifications_organization_id_sent_at_idx" ON "sent_notifications"("organization_id", "sent_at");

-- CreateIndex
CREATE INDEX "sent_notifications_automation_id_idx" ON "sent_notifications"("automation_id");

-- CreateIndex
CREATE INDEX "sent_notifications_run_id_idx" ON "sent_notifications"("run_id");
