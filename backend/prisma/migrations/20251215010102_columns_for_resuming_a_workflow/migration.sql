-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "require_approval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "run_history_records" ADD COLUMN     "pending_approval_interruptions" JSONB,
ADD COLUMN     "pending_approval_state" JSONB;
