-- CreateTable
CREATE TABLE "run_failure_snapshots" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "snapshot_image_id" TEXT NOT NULL,
    "restored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_failure_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_failure_snapshots_run_id_idx" ON "run_failure_snapshots"("run_id");

-- AddForeignKey
ALTER TABLE "run_failure_snapshots" ADD CONSTRAINT "run_failure_snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run_history_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
