-- Add Slack DM target metadata for notification destinations
ALTER TABLE "user_notification_destinations"
ADD COLUMN "slack_user_id" TEXT,
ADD COLUMN "slack_user_name" TEXT;

CREATE INDEX "user_notification_destinations_slack_user_id_idx" ON "user_notification_destinations"("slack_user_id");
