ALTER TABLE "notion_integrations"
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "access_token_expires_at" TIMESTAMP(3);
