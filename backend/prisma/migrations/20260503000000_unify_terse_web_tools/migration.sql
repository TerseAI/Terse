-- Replace the catch-all TERSE OutputConfigType with two narrower types: WEB
-- (search + extract + research) and IMAGE_EDIT. Existing TERSE rows are
-- breaking-change deleted; users must re-push their jobs.
DELETE FROM "automation_outputs" WHERE "config_type" = 'TERSE';
DELETE FROM "output_change_attributions" WHERE "output_item_type" = 'TERSE';

ALTER TYPE "OutputConfigType" RENAME TO "OutputConfigType_old";
CREATE TYPE "OutputConfigType" AS ENUM ('NOTION', 'LINEAR_TICKET', 'SLACK_CHANNEL', 'GMAIL', 'GMAIL_DRAFT', 'WEB', 'IMAGE_EDIT', 'ATTIO', 'GITHUB', 'POSTHOG', 'LAUNCHDARKLY', 'DATADOG', 'WORKOS', 'SNOWFLAKE');
ALTER TABLE "automation_outputs" ALTER COLUMN "config_type" TYPE "OutputConfigType" USING ("config_type"::text::"OutputConfigType");
ALTER TABLE "output_change_attributions" ALTER COLUMN "output_item_type" TYPE "OutputConfigType" USING ("output_item_type"::text::"OutputConfigType");
DROP TYPE "OutputConfigType_old";
