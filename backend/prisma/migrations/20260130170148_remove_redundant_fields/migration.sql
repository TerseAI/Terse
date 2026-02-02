/*
  Warnings:

  - You are about to drop the column `display_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `github_username` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `is_placeholder` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_github_username_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "display_name",
DROP COLUMN "email",
DROP COLUMN "github_username",
DROP COLUMN "is_placeholder";
