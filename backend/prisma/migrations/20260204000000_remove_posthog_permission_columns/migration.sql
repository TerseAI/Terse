/*
  Warnings:

  - You are about to drop the column `can_read_logs` on the `automation_posthog_configs` table. All the data in the column will be lost.
  - You are about to drop the column `can_read_session_recordings` on the `automation_posthog_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "automation_posthog_configs" DROP COLUMN "can_read_logs";
ALTER TABLE "automation_posthog_configs" DROP COLUMN "can_read_session_recordings";
