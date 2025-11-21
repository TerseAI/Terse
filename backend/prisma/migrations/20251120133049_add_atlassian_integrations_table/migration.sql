-- CreateTable
CREATE TABLE "atlassian_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "jira_user_email" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "site_name" TEXT,
    "project_key" TEXT,
    "project_name" TEXT,
    "webhook_id" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlassian_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "atlassian_integrations_user_id_idx" ON "atlassian_integrations"("user_id");

-- CreateIndex
CREATE INDEX "atlassian_integrations_base_url_project_key_idx" ON "atlassian_integrations"("base_url", "project_key");

-- CreateIndex
CREATE INDEX "atlassian_integrations_token_expiry_idx" ON "atlassian_integrations"("token_expiry");

-- AddForeignKey
ALTER TABLE "atlassian_integrations" ADD CONSTRAINT "atlassian_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

