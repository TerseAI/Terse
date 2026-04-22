-- AlterTable
ALTER TABLE "api_tokens" ADD COLUMN     "project_id" TEXT;

-- CreateIndex
CREATE INDEX "api_tokens_project_id_idx" ON "api_tokens"("project_id");

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
