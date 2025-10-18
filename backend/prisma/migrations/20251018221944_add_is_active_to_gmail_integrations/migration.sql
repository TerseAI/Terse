-- AlterTable
ALTER TABLE "gmail_integrations" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "gmail_integrations_is_active_idx" ON "gmail_integrations"("is_active");
