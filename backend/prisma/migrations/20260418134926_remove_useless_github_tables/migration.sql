/*
  Warnings:

  - You are about to drop the `github_repositories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_github_installation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_github_repositories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_github_installation" DROP CONSTRAINT "user_github_installation_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_github_repositories" DROP CONSTRAINT "user_github_repositories_github_repository_id_fkey";

-- DropForeignKey
ALTER TABLE "user_github_repositories" DROP CONSTRAINT "user_github_repositories_user_id_fkey";

-- DropTable
DROP TABLE "github_repositories";

-- DropTable
DROP TABLE "user_github_installation";

-- DropTable
DROP TABLE "user_github_repositories";
