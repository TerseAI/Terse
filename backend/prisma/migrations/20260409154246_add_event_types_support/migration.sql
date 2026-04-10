-- AlterTable
ALTER TABLE "automation_linear_configs" ADD COLUMN     "event_types" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "automation_slack_configs" ADD COLUMN     "event_types" TEXT[] DEFAULT ARRAY[]::TEXT[];
