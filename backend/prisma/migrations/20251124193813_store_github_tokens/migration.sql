-- CreateTable
CREATE TABLE "github_app_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_username" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_app_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_app_tokens_user_id_github_username_key" ON "github_app_tokens"("user_id", "github_username");

-- AddForeignKey
ALTER TABLE "github_app_tokens" ADD CONSTRAINT "github_app_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
