-- AlterTable
ALTER TABLE "directive_records" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "directive_records_is_active_idx" ON "directive_records"("is_active");
