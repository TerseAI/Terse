/*
  Warnings:

  - Made the column `project_id` on table `automations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "automations" ALTER COLUMN "project_id" SET NOT NULL;
