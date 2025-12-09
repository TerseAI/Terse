-- Drop the existing unique constraint
ALTER TABLE "user_slack_integrations" DROP CONSTRAINT IF EXISTS "user_slack_integrations_user_id_slack_team_id_key";

-- Add is_bot_user column with default true (existing rows are bot tokens)
ALTER TABLE "user_slack_integrations" ADD COLUMN "is_bot_user" BOOLEAN NOT NULL DEFAULT true;

-- Update existing rows: if authed_user_access_token is not null, it's a user token
UPDATE "user_slack_integrations" SET "is_bot_user" = false WHERE "authed_user_access_token" IS NOT NULL;

-- Add new unique constraint that allows one bot and one user per user/team
ALTER TABLE "user_slack_integrations" ADD CONSTRAINT "user_slack_integrations_user_id_slack_team_id_is_bot_user_key" UNIQUE ("user_id", "slack_team_id", "is_bot_user");

