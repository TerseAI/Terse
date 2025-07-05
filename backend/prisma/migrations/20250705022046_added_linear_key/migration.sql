-- CreateTable
CREATE TABLE "linear_api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linear_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linear_api_keys_api_key_key" ON "linear_api_keys"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "linear_api_keys_user_id_key" ON "linear_api_keys"("user_id");

-- AddForeignKey
ALTER TABLE "linear_api_keys" ADD CONSTRAINT "linear_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
