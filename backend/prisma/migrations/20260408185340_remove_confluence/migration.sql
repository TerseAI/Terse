/*
  Warnings:

  - The values [CONFLUENCE] on the enum `OutputConfigType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OutputConfigType_new" AS ENUM ('NOTION', 'LINEAR_TICKET', 'SLACK_CHANNEL', 'GMAIL', 'GMAIL_DRAFT', 'TERSE', 'ATTIO', 'GITHUB', 'POSTHOG', 'LAUNCHDARKLY', 'DATADOG', 'WORKOS', 'SNOWFLAKE');
ALTER TABLE "automation_outputs" ALTER COLUMN "config_type" TYPE "OutputConfigType_new" USING ("config_type"::text::"OutputConfigType_new");
ALTER TABLE "output_change_attributions" ALTER COLUMN "output_item_type" TYPE "OutputConfigType_new" USING ("output_item_type"::text::"OutputConfigType_new");
ALTER TYPE "OutputConfigType" RENAME TO "OutputConfigType_old";
ALTER TYPE "OutputConfigType_new" RENAME TO "OutputConfigType";
DROP TYPE "public"."OutputConfigType_old";
COMMIT;
