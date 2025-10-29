-- DropIndex
DROP INDEX "public"."jira_api_keys_user_id_key";

-- DropIndex
DROP INDEX "public"."linear_api_keys_linear_user_id_key";

-- DropIndex
DROP INDEX "public"."linear_api_keys_user_id_key";

-- DropIndex
DROP INDEX "public"."notion_integrations_user_id_key";

-- AlterTable
ALTER TABLE "jira_api_keys" ADD COLUMN     "project_key" TEXT,
ADD COLUMN     "project_name" TEXT,
ADD COLUMN     "site_name" TEXT;

-- AlterTable
ALTER TABLE "linear_api_keys" ADD COLUMN     "team_id" TEXT,
ADD COLUMN     "team_name" TEXT,
ADD COLUMN     "workspace_id" TEXT,
ADD COLUMN     "workspace_name" TEXT;

-- AlterTable
ALTER TABLE "notion_integrations" ADD COLUMN     "database_name" TEXT,
ADD COLUMN     "workspace_id" TEXT,
ADD COLUMN     "workspace_name" TEXT;

-- CreateIndex
CREATE INDEX "jira_api_keys_user_id_idx" ON "jira_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "jira_api_keys_base_url_project_key_idx" ON "jira_api_keys"("base_url", "project_key");

-- CreateIndex
CREATE INDEX "linear_api_keys_user_id_idx" ON "linear_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "linear_api_keys_workspace_id_team_id_idx" ON "linear_api_keys"("workspace_id", "team_id");

-- CreateIndex
CREATE INDEX "notion_integrations_user_id_idx" ON "notion_integrations"("user_id");

-- CreateIndex
CREATE INDEX "notion_integrations_workspace_id_database_id_idx" ON "notion_integrations"("workspace_id", "database_id");
