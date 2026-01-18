/*
  Warnings:

  - You are about to drop the column `can_read_logs` on the `automation_datadog_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "automation_datadog_configs" DROP COLUMN "can_read_logs";
