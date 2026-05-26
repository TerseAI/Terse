-- CreateTable
CREATE TABLE "secret_blobs" (
    "blob_id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
