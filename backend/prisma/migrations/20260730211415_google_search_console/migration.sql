-- CreateTable
CREATE TABLE "google_search_console_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_search_console_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "google_search_console_integrations_user_id_idx" ON "google_search_console_integrations"("user_id");

-- CreateIndex
CREATE INDEX "google_search_console_integrations_organization_id_idx" ON "google_search_console_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "google_search_console_integrations_is_active_idx" ON "google_search_console_integrations"("is_active");
