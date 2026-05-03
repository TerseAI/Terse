-- Delete existing TERSE output configs (breaking change, no backward compat)
DELETE FROM "agent_output_configs" WHERE "config_type" = 'TERSE';

-- Alter enum: remove TERSE, add WEB_SEARCH, WEB_EXTRACT, WEB_RESEARCH, IMAGE_EDIT
ALTER TYPE "OutputConfigType" RENAME TO "OutputConfigType_old";
CREATE TYPE "OutputConfigType" AS ENUM ('NOTION', 'LINEAR_TICKET', 'SLACK_CHANNEL', 'GMAIL', 'GMAIL_DRAFT', 'WEB_SEARCH', 'WEB_EXTRACT', 'WEB_RESEARCH', 'IMAGE_EDIT', 'ATTIO', 'GITHUB', 'POSTHOG', 'LAUNCHDARKLY', 'DATADOG', 'WORKOS', 'SNOWFLAKE');
ALTER TABLE "agent_output_configs" ALTER COLUMN "config_type" TYPE "OutputConfigType" USING ("config_type"::text::"OutputConfigType");
DROP TYPE "OutputConfigType_old";
