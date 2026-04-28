-- AlterTable
ALTER TABLE "billing_period_consumption" ADD COLUMN "notified_thresholds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
