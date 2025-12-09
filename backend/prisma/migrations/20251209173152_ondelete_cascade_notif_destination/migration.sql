-- DropForeignKey
ALTER TABLE "user_notification_destinations" DROP CONSTRAINT "user_notification_destinations_slack_integration_id_fkey";

-- AddForeignKey
ALTER TABLE "user_notification_destinations" ADD CONSTRAINT "user_notification_destinations_slack_integration_id_fkey" FOREIGN KEY ("slack_integration_id") REFERENCES "user_slack_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
