-- Add new array columns with defaults
ALTER TABLE "automation_notion_configs" ADD COLUMN "database_ids" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;
ALTER TABLE "automation_notion_configs" ADD COLUMN "database_names" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;
ALTER TABLE "automation_notion_configs" ADD COLUMN "page_ids" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;
ALTER TABLE "automation_notion_configs" ADD COLUMN "page_names" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;

-- Backfill from existing single columns (one-element arrays or empty)
UPDATE "automation_notion_configs"
SET
  "database_ids" = CASE WHEN "database_id" IS NOT NULL AND "database_id" != '' THEN ARRAY["database_id"] ELSE ARRAY[]::TEXT[] END,
  "database_names" = CASE WHEN "database_name" IS NOT NULL AND "database_name" != '' THEN ARRAY["database_name"] ELSE ARRAY[]::TEXT[] END,
  "page_ids" = CASE WHEN "page_id" IS NOT NULL AND "page_id" != '' THEN ARRAY["page_id"] ELSE ARRAY[]::TEXT[] END,
  "page_names" = CASE WHEN "page_name" IS NOT NULL AND "page_name" != '' THEN ARRAY["page_name"] ELSE ARRAY[]::TEXT[] END;

-- Drop old indexes (on columns we are about to drop)
DROP INDEX IF EXISTS "automation_notion_configs_database_id_idx";
DROP INDEX IF EXISTS "automation_notion_configs_page_id_idx";

-- Drop old columns
ALTER TABLE "automation_notion_configs" DROP COLUMN "database_id";
ALTER TABLE "automation_notion_configs" DROP COLUMN "database_name";
ALTER TABLE "automation_notion_configs" DROP COLUMN "page_id";
ALTER TABLE "automation_notion_configs" DROP COLUMN "page_name";
