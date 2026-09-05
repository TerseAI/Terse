-- Durable workflow journals now live in the durable-object control plane.
ALTER TABLE "automations"
ADD COLUMN "is_durable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "durable_journal_backend" TEXT;

ALTER TABLE "run_history_records"
ADD COLUMN "is_durable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "durable_journal_backend" TEXT;

ALTER TABLE "project_deploy_jobs"
ADD COLUMN "is_durable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "durable_journal_backend" TEXT;

-- Durable-object runs do not have an image; existing snapshot-backed rows keep theirs.
ALTER TABLE "run_suspensions" ALTER COLUMN "suspend_image_id" DROP NOT NULL;
