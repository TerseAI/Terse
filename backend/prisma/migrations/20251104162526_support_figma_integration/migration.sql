-- CreateTable
CREATE TABLE "figma_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "figma_user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "figma_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "figma_integrations_user_id_idx" ON "figma_integrations"("user_id");

-- CreateIndex
CREATE INDEX "figma_integrations_figma_user_id_idx" ON "figma_integrations"("figma_user_id");

-- AddForeignKey
ALTER TABLE "figma_integrations" ADD CONSTRAINT "figma_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
