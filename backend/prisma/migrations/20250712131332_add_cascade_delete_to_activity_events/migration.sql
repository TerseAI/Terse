-- DropForeignKey
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_github_repository_id_fkey";

-- DropForeignKey
ALTER TABLE "ticket_activity_events" DROP CONSTRAINT "ticket_activity_events_activity_event_id_fkey";

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_github_repository_id_fkey" FOREIGN KEY ("github_repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_activity_events" ADD CONSTRAINT "ticket_activity_events_activity_event_id_fkey" FOREIGN KEY ("activity_event_id") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
