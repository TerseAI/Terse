/*
  Warnings:

  - Made the column `space_id` on table `automation_confluence_configs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `page_name` on table `automation_confluence_configs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `space_name` on table `automation_confluence_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "automation_confluence_configs" ALTER COLUMN "space_id" SET NOT NULL,
ALTER COLUMN "page_name" SET NOT NULL,
ALTER COLUMN "space_name" SET NOT NULL;

-- CreateTable
CREATE TABLE "user_github_installation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "installation_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_github_installation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_github_installation_installation_id_key" ON "user_github_installation"("installation_id");

-- AddForeignKey
ALTER TABLE "user_github_installation" ADD CONSTRAINT "user_github_installation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
