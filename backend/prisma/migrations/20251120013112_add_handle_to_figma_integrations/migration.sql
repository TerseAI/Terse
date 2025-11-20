/*
  Warnings:

  - Added the required column `handle` to the `figma_integrations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "figma_integrations" ADD COLUMN "handle" TEXT NULL;

-- DEFAULT to figma user id, will only have handle set properly for future integrations.
-- that get connected
UPDATE "figma_integrations" SET "handle" = "figma_user_id";

ALTER TABLE "figma_integrations" ALTER COLUMN "handle" SET NOT NULL;
