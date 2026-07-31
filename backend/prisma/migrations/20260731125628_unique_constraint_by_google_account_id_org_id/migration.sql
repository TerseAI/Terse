/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,google_account_id]` on the table `google_search_console_integrations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "google_search_console_integrations_is_active_idx";

-- DropIndex
DROP INDEX "google_search_console_integrations_organization_id_idx";

-- DropIndex
DROP INDEX "google_search_console_integrations_user_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "google_search_console_integrations_organization_id_google_a_key" ON "google_search_console_integrations"("organization_id", "google_account_id");
