-- CreateTable
CREATE TABLE "jira_api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "jira_user_email" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "jira_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_api_keys_api_token_key" ON "jira_api_keys"("api_token");

-- CreateIndex
CREATE UNIQUE INDEX "jira_api_keys_user_id_key" ON "jira_api_keys"("user_id");

-- AddForeignKey
ALTER TABLE "jira_api_keys" ADD CONSTRAINT "jira_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
