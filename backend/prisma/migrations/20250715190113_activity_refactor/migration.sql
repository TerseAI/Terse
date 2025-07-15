-- DropForeignKey
ALTER TABLE "ticket_activity_events" DROP CONSTRAINT "ticket_activity_events_activity_event_id_fkey";

-- CreateTable
CREATE TABLE "sub_activity_events" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activity_event_id" TEXT NOT NULL,

    CONSTRAINT "sub_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_activity_commit_associations" (
    "id" TEXT NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "commit_message" TEXT NOT NULL,
    "commit_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sub_activity_event_id" TEXT NOT NULL,

    CONSTRAINT "sub_activity_commit_associations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sub_activity_events" ADD CONSTRAINT "sub_activity_events_activity_event_id_fkey" FOREIGN KEY ("activity_event_id") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_activity_commit_associations" ADD CONSTRAINT "sub_activity_commit_associations_sub_activity_event_id_fkey" FOREIGN KEY ("sub_activity_event_id") REFERENCES "sub_activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
