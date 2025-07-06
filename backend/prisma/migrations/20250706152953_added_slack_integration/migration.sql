-- CreateTable
CREATE TABLE "slack_integrations" (
    "user_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "authed_user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "access_token" TEXT NOT NULL,
    "bot_user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "enterprise_id" TEXT,
    "enterprise_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("app_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_app_id_key" ON "slack_integrations"("app_id");

-- AddForeignKey
ALTER TABLE "slack_integrations" ADD CONSTRAINT "slack_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
