/*
  Warnings:

  - You are about to drop the column `site_url` on the `google_search_console_integrations` table. All the data in the column will be lost.
  - Added the required column `email` to the `google_search_console_integrations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `google_account_id` to the `google_search_console_integrations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "google_search_console_integrations" DROP COLUMN "site_url",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "google_account_id" TEXT NOT NULL;
