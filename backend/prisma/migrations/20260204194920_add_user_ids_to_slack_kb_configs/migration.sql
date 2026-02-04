-- AlterTable
ALTER TABLE "automation_slack_kb_configs" ADD COLUMN     "user_ids" TEXT[],
ADD COLUMN     "user_names" TEXT[];
