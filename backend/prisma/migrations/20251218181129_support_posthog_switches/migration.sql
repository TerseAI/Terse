-- AlterTable
ALTER TABLE "automation_posthog_configs" ADD COLUMN     "can_read_logs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_read_session_recordings" BOOLEAN NOT NULL DEFAULT false;
