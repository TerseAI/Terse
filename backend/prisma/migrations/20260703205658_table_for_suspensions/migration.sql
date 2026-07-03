/*
  Warnings:

  - You are about to drop the column `suspend_image_id` on the `run_history_records` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RunSuspensionKind" AS ENUM ('input', 'timer');

-- AlterTable
ALTER TABLE "run_history_records" DROP COLUMN "suspend_image_id";

-- CreateTable
CREATE TABLE "run_suspensions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "kind" "RunSuspensionKind" NOT NULL,
    "suspend_image_id" TEXT NOT NULL,
    "hook_token" TEXT,
    "delay_seconds" INTEGER,
    "resumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_suspensions_run_id_idx" ON "run_suspensions"("run_id");

-- AddForeignKey
ALTER TABLE "run_suspensions" ADD CONSTRAINT "run_suspensions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
