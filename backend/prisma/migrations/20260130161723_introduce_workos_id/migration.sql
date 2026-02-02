-- AlterTable
ALTER TABLE "users" ADD COLUMN     "workos_id" TEXT;

-- CreateIndex
CREATE INDEX "users_workos_id_idx" ON "users"("workos_id");
