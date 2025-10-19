-- CreateTable
CREATE TABLE "notion_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "integration_token" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notion_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notion_integrations_user_id_key" ON "notion_integrations"("user_id");

-- AddForeignKey
ALTER TABLE "notion_integrations" ADD CONSTRAINT "notion_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
