-- AlterTable
ALTER TABLE "run_history_actions" ADD COLUMN     "step_id" TEXT;

-- CreateIndex
CREATE INDEX "run_history_actions_step_id_idx" ON "run_history_actions"("step_id");
