-- CreateEnum
CREATE TYPE "NotificationDestinationType" AS ENUM ('SLACK', 'EMAIL');

-- CreateTable
CREATE TABLE "automation_notification_settings" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "action_types" "RunHistoryActionType"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_destinations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "destination_type" "NotificationDestinationType" NOT NULL,
    "slack_integration_id" TEXT,
    "slack_channel_id" TEXT,
    "slack_channel_name" TEXT,
    "email_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_notification_settings_automation_id_key" ON "automation_notification_settings"("automation_id");

-- CreateIndex
CREATE INDEX "user_notification_destinations_user_id_idx" ON "user_notification_destinations"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_destinations_destination_type_idx" ON "user_notification_destinations"("destination_type");

-- AddForeignKey
ALTER TABLE "automation_notification_settings" ADD CONSTRAINT "automation_notification_settings_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_destinations" ADD CONSTRAINT "user_notification_destinations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_destinations" ADD CONSTRAINT "user_notification_destinations_slack_integration_id_fkey" FOREIGN KEY ("slack_integration_id") REFERENCES "slack_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
