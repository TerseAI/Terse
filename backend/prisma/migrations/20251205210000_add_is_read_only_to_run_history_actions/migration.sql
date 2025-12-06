-- AlterTable
ALTER TABLE "run_history_actions" ADD COLUMN "is_read_only" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "run_history_actions_is_read_only_idx" ON "run_history_actions"("is_read_only");

