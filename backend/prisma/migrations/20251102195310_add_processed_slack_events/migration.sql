-- AlterTable
ALTER TABLE "pending_approvals" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '24 hours';

-- CreateTable
CREATE TABLE "processed_slack_events" (
    "id" TEXT NOT NULL,
    "slack_integration_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_slack_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_slack_events_slack_integration_id_idx" ON "processed_slack_events"("slack_integration_id");

-- CreateIndex
CREATE INDEX "processed_slack_events_processed_at_idx" ON "processed_slack_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_slack_events_slack_integration_id_event_id_key" ON "processed_slack_events"("slack_integration_id", "event_id");

-- AddForeignKey
ALTER TABLE "processed_slack_events" ADD CONSTRAINT "processed_slack_events_slack_integration_id_fkey" FOREIGN KEY ("slack_integration_id") REFERENCES "slack_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
