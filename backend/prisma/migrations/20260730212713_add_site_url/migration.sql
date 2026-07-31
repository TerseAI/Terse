/*
  Warnings:

  - Added the required column `site_url` to the `google_search_console_integrations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "google_search_console_integrations" ADD COLUMN     "site_url" TEXT NOT NULL;
