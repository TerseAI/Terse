-- CreateTable
CREATE TABLE "cached_resources" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_resources_cache_key_key" ON "cached_resources"("cache_key");

-- CreateIndex
CREATE INDEX "cached_resources_expires_at_idx" ON "cached_resources"("expires_at");

-- CreateIndex
CREATE INDEX "cached_resources_source_idx" ON "cached_resources"("source");

