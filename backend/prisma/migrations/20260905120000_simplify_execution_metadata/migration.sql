DROP TABLE "organization_settings";
ALTER TABLE "run_history_records" DROP COLUMN "execution_region";

-- The journal backend on the deployment and run fully describes recovery.
ALTER TABLE "automations" DROP COLUMN "is_durable", DROP COLUMN "durable_journal_backend";
ALTER TABLE "project_deploy_jobs" DROP COLUMN "is_durable";
ALTER TABLE "run_history_records" DROP COLUMN "is_durable";
