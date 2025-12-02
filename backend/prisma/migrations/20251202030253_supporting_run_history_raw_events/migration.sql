-- CreateTable
CREATE TABLE "run_history_raw_events" (
    "id" TEXT NOT NULL,
    "run_history_record_id" TEXT NOT NULL,
    "raw_event_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_history_raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_history_raw_events_run_history_record_id_idx" ON "run_history_raw_events"("run_history_record_id");

-- CreateIndex
CREATE INDEX "run_history_raw_events_created_at_idx" ON "run_history_raw_events"("created_at");

-- AddForeignKey
ALTER TABLE "run_history_raw_events" ADD CONSTRAINT "run_history_raw_events_run_history_record_id_fkey" FOREIGN KEY ("run_history_record_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
