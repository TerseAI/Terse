-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "deployed_at" TIMESTAMP(3);

-- Backfill: every pre-existing automation was created by a deploy, so mark it deployed.
-- (Going forward, only `terse test` drafts have a null deployed_at.)
UPDATE "automations" SET "deployed_at" = "created_at" WHERE "deployed_at" IS NULL;

-- AlterTable
ALTER TABLE "run_history_records" ADD COLUMN     "is_test" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "run_history_records_is_test_idx" ON "run_history_records"("is_test");
