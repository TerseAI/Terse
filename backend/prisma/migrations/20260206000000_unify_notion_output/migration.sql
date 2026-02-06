-- Unify Notion Page and Notion Database into single NOTION output type
-- Do not ADD VALUE 'NOTION' to existing enum (cannot use new enum value in same transaction in PostgreSQL).
-- Instead create a new enum and switch columns to it.

-- 1. Add page columns to automation_notion_configs; make database columns nullable
ALTER TABLE "automation_notion_configs" ADD COLUMN IF NOT EXISTS "page_id" TEXT;
ALTER TABLE "automation_notion_configs" ADD COLUMN IF NOT EXISTS "page_name" TEXT;
ALTER TABLE "automation_notion_configs" ALTER COLUMN "database_id" DROP NOT NULL;
ALTER TABLE "automation_notion_configs" ALTER COLUMN "database_name" DROP NOT NULL;

-- 2. Copy notion_page_configs into notion_configs
INSERT INTO "automation_notion_configs" ("id", "automation_output_id", "automation_input_id", "database_id", "database_name", "page_id", "page_name", "created_at", "updated_at")
SELECT gen_random_uuid()::text, p."automation_output_id", p."automation_input_id", NULL, NULL, p."page_id", p."page_name", p."created_at", p."updated_at"
FROM "automation_notion_page_configs" p;

-- 3. Drop old table (and its FKs)
ALTER TABLE "automation_notion_page_configs" DROP CONSTRAINT IF EXISTS "automation_notion_page_configs_automation_output_id_fkey";
ALTER TABLE "automation_notion_page_configs" DROP CONSTRAINT IF EXISTS "automation_notion_page_configs_automation_input_id_fkey";
DROP TABLE IF EXISTS "automation_notion_page_configs";

-- 4. Replace OutputConfigType enum: create new type with NOTION (no NOTION_PAGE/NOTION_DATABASE), then switch columns
CREATE TYPE "OutputConfigType_new" AS ENUM ('NOTION', 'CONFLUENCE', 'LINEAR_TICKET', 'JIRA_TICKET', 'SLACK_CHANNEL', 'GMAIL', 'TERSE');

ALTER TABLE "automation_outputs" ALTER COLUMN "config_type" TYPE "OutputConfigType_new" USING (
  CASE "config_type"::text
    WHEN 'NOTION_PAGE' THEN 'NOTION'::"OutputConfigType_new"
    WHEN 'NOTION_DATABASE' THEN 'NOTION'::"OutputConfigType_new"
    ELSE "config_type"::text::"OutputConfigType_new"
  END
);

ALTER TABLE "output_change_attributions" ALTER COLUMN "output_item_type" TYPE "OutputConfigType_new" USING (
  CASE "output_item_type"::text
    WHEN 'NOTION_PAGE' THEN 'NOTION'::"OutputConfigType_new"
    WHEN 'NOTION_DATABASE' THEN 'NOTION'::"OutputConfigType_new"
    ELSE "output_item_type"::text::"OutputConfigType_new"
  END
);

DROP TYPE "OutputConfigType";
ALTER TYPE "OutputConfigType_new" RENAME TO "OutputConfigType";

-- 5. Create index on page_id
CREATE INDEX IF NOT EXISTS "automation_notion_configs_page_id_idx" ON "automation_notion_configs"("page_id");
