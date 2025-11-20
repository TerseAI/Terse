-- CreateTable
CREATE TABLE "linear_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "linear_user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "workspace_name" TEXT,
    "team_id" TEXT,
    "team_name" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "webhook_secret" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linear_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linear_integrations_user_id_idx" ON "linear_integrations"("user_id");

-- CreateIndex
CREATE INDEX "linear_integrations_workspace_id_team_id_idx" ON "linear_integrations"("workspace_id", "team_id");

-- CreateIndex
CREATE INDEX "linear_integrations_token_expiry_idx" ON "linear_integrations"("token_expiry");

-- AddForeignKey
ALTER TABLE "linear_integrations" ADD CONSTRAINT "linear_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
