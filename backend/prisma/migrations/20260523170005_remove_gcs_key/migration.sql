/*
  Warnings:

  - You are about to drop the column `gcs_key` on the `sdk_source_images` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "sdk_source_images_gcs_key_idx";

-- AlterTable
ALTER TABLE "sdk_source_images" DROP COLUMN "gcs_key";
