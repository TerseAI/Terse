-- DropForeignKey
ALTER TABLE "ticket_activity_events" DROP CONSTRAINT "ticket_activity_events_user_id_fkey";

-- CreateTable
CREATE TABLE "project_activity_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "activity_event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_activity_events_project_id_idx" ON "project_activity_events"("project_id");

-- AddForeignKey
ALTER TABLE "ticket_activity_events" ADD CONSTRAINT "ticket_activity_events_activity_event_id_fkey" FOREIGN KEY ("activity_event_id") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_activity_events" ADD CONSTRAINT "ticket_activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activity_events" ADD CONSTRAINT "project_activity_events_activity_event_id_fkey" FOREIGN KEY ("activity_event_id") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activity_events" ADD CONSTRAINT "project_activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
