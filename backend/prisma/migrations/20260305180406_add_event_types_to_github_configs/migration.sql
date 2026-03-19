-- AlterTable
ALTER TABLE "automation_github_configs" ADD COLUMN     "event_types" TEXT[] DEFAULT ARRAY[]::TEXT[];
