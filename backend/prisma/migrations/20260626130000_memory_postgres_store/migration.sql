-- AlterTable
ALTER TABLE "run_history_records" ADD COLUMN     "replay_of_run_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "snapshot_retention_days" INTEGER;

-- CreateTable
CREATE TABLE "memory_blobs" (
    "hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_blobs_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "memory_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subtree_key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "blob_hash" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_snapshots" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_snapshot_entries" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "subtree_key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "blob_hash" TEXT NOT NULL,

    CONSTRAINT "memory_snapshot_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memory_entries_project_id_subtree_key_path_key" ON "memory_entries"("project_id", "subtree_key", "path");

-- CreateIndex
CREATE UNIQUE INDEX "memory_snapshots_run_id_key" ON "memory_snapshots"("run_id");

-- CreateIndex
CREATE INDEX "memory_snapshots_expires_at_idx" ON "memory_snapshots"("expires_at");

-- CreateIndex
CREATE INDEX "memory_snapshots_project_id_idx" ON "memory_snapshots"("project_id");

-- CreateIndex
CREATE INDEX "memory_snapshot_entries_snapshot_id_idx" ON "memory_snapshot_entries"("snapshot_id");

-- AddForeignKey
ALTER TABLE "memory_snapshot_entries" ADD CONSTRAINT "memory_snapshot_entries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "memory_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
