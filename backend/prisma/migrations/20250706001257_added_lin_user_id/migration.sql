/*
  Warnings:

  - A unique constraint covering the columns `[linear_user_id]` on the table `linear_api_keys` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `linear_user_id` to the `linear_api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "linear_api_keys" ADD COLUMN     "linear_user_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "linear_api_keys_linear_user_id_key" ON "linear_api_keys"("linear_user_id");
