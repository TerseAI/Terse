-- CreateEnum
CREATE TYPE "RunHistoryStatus" AS ENUM ('success', 'failed', 'skipped', 'in_progress');

-- CreateEnum
CREATE TYPE "RunHistoryDecisionAction" AS ENUM ('processed', 'skipped');

-- CreateEnum
CREATE TYPE "RunHistoryIntegration" AS ENUM ('jira', 'linear', 'slack', 'github', 'notion', 'gmail');

-- CreateTable
CREATE TABLE "run_history_records" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "trigger_integration" "RunHistoryIntegration" NOT NULL,
    "trigger_source" TEXT NOT NULL,
    "trigger_title" TEXT,
    "trigger_subheader" TEXT,
    "trigger_url" TEXT,
    "filtered" BOOLEAN NOT NULL DEFAULT false,
    "decision_action" "RunHistoryDecisionAction" NOT NULL,
    "decision_reason" TEXT NOT NULL,
    "status" "RunHistoryStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_history_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_history_actions" (
    "id" TEXT NOT NULL,
    "run_history_record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "integration" "RunHistoryIntegration" NOT NULL,
    "target" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_history_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_history_records_automation_id_idx" ON "run_history_records"("automation_id");

-- CreateIndex
CREATE INDEX "run_history_records_status_idx" ON "run_history_records"("status");

-- CreateIndex
CREATE INDEX "run_history_records_timestamp_idx" ON "run_history_records"("timestamp");

-- CreateIndex
CREATE INDEX "run_history_actions_run_history_record_id_idx" ON "run_history_actions"("run_history_record_id");

-- AddForeignKey
ALTER TABLE "run_history_records" ADD CONSTRAINT "run_history_records_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_history_actions" ADD CONSTRAINT "run_history_actions_run_history_record_id_fkey" FOREIGN KEY ("run_history_record_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
