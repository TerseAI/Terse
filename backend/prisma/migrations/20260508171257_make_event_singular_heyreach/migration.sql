/*
  Warnings:

  - You are about to drop the column `event_types` on the `automation_hey_reach_configs` table. All the data in the column will be lost.
  - Added the required column `event_type` to the `automation_hey_reach_configs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "automation_hey_reach_configs" DROP COLUMN "event_types",
ADD COLUMN     "event_type" TEXT NOT NULL;
