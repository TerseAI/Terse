-- CreateTable
CREATE TABLE "public"."gmail_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "history_id" TEXT NOT NULL,
    "watch_expiration" TIMESTAMP(3) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gmail_integrations_email_idx" ON "public"."gmail_integrations"("email");

-- CreateIndex
CREATE INDEX "gmail_integrations_watch_expiration_idx" ON "public"."gmail_integrations"("watch_expiration");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_integrations_user_id_email_key" ON "public"."gmail_integrations"("user_id", "email");

-- AddForeignKey
ALTER TABLE "public"."gmail_integrations" ADD CONSTRAINT "gmail_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
