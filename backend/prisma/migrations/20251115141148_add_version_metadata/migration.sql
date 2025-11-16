-- Add version metadata fields to track who published and when
ALTER TABLE "automation_versions" 
ADD COLUMN "published_by" TEXT,
ADD COLUMN "published_at" TIMESTAMP;

-- Add index for published_at to support efficient queries of version history
CREATE INDEX IF NOT EXISTS "automation_versions_published_at_idx" ON "automation_versions"("published_at");

