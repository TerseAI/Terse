-- AlterEnum
ALTER TYPE "RunHistoryStatus" ADD VALUE 'blocked';

-- AlterTable
ALTER TABLE "automation_inputs" ADD COLUMN "disconnected_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "automation_outputs" ADD COLUMN "disconnected_at" TIMESTAMP(3);
