-- CreateTable
CREATE TABLE "directive_records" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "run_history_record_id" TEXT NOT NULL,
    "run_history_chat_event_id" TEXT NOT NULL,
    "directive_description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directive_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directive_records_automation_id_idx" ON "directive_records"("automation_id");

-- CreateIndex
CREATE INDEX "directive_records_run_history_record_id_idx" ON "directive_records"("run_history_record_id");

-- CreateIndex
CREATE INDEX "directive_records_run_history_chat_event_id_idx" ON "directive_records"("run_history_chat_event_id");

-- AddForeignKey
ALTER TABLE "directive_records" ADD CONSTRAINT "directive_records_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_records" ADD CONSTRAINT "directive_records_run_history_record_id_fkey" FOREIGN KEY ("run_history_record_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_records" ADD CONSTRAINT "directive_records_run_history_chat_event_id_fkey" FOREIGN KEY ("run_history_chat_event_id") REFERENCES "run_history_chat_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
