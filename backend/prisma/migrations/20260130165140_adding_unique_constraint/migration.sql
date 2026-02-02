/*
  Warnings:

  - A unique constraint covering the columns `[workos_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Made the column `workos_id` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "workos_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_workos_id_key" ON "users"("workos_id");
