-- Clean up orphaned approval_slack_messages before adding FK constraint
DELETE FROM "approval_slack_messages"
WHERE "run_id" NOT IN (SELECT "id" FROM "run_history_records");

-- Clean up orphaned sent_notifications before adding FK constraints
UPDATE "sent_notifications" SET "automation_id" = NULL
WHERE "automation_id" IS NOT NULL
AND "automation_id" NOT IN (SELECT "id" FROM "automations");

UPDATE "sent_notifications" SET "run_id" = NULL
WHERE "run_id" IS NOT NULL
AND "run_id" NOT IN (SELECT "id" FROM "run_history_records");

-- AddForeignKey
ALTER TABLE "approval_slack_messages" ADD CONSTRAINT "approval_slack_messages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_notifications" ADD CONSTRAINT "sent_notifications_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_notifications" ADD CONSTRAINT "sent_notifications_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
