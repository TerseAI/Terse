/*
  Warnings:

  - A unique constraint covering the columns `[github_username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_placeholder" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "github_repositories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "installation_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_github_repositories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_repository_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_github_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_github_repositories_user_id_github_repository_id_key" ON "user_github_repositories"("user_id", "github_repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_username_key" ON "users"("github_username");

-- AddForeignKey
ALTER TABLE "user_github_repositories" ADD CONSTRAINT "user_github_repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_github_repositories" ADD CONSTRAINT "user_github_repositories_github_repository_id_fkey" FOREIGN KEY ("github_repository_id") REFERENCES "github_repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
