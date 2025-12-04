-- Convert and change column types from RunHistoryIntegration to IntegrationType
-- Mapping: lowercase -> uppercase (e.g., 'github' -> 'GITHUB')
ALTER TABLE "run_history_records" 
    ALTER COLUMN "trigger_integration" TYPE "IntegrationType" 
    USING CASE
        WHEN "trigger_integration"::text = 'jira' THEN 'JIRA'::text
        WHEN "trigger_integration"::text = 'linear' THEN 'LINEAR'::text
        WHEN "trigger_integration"::text = 'slack' THEN 'SLACK'::text
        WHEN "trigger_integration"::text = 'github' THEN 'GITHUB'::text
        WHEN "trigger_integration"::text = 'notion' THEN 'NOTION'::text
        WHEN "trigger_integration"::text = 'gmail' THEN 'GMAIL'::text
        WHEN "trigger_integration"::text = 'figma' THEN 'FIGMA'::text
        WHEN "trigger_integration"::text = 'confluence' THEN 'CONFLUENCE'::text
        WHEN "trigger_integration"::text = 'terse' THEN 'TERSE'::text
        ELSE "trigger_integration"::text
    END::"IntegrationType";

ALTER TABLE "run_history_actions" 
    ALTER COLUMN "integration" TYPE "IntegrationType" 
    USING CASE
        WHEN "integration"::text = 'jira' THEN 'JIRA'::text
        WHEN "integration"::text = 'linear' THEN 'LINEAR'::text
        WHEN "integration"::text = 'slack' THEN 'SLACK'::text
        WHEN "integration"::text = 'github' THEN 'GITHUB'::text
        WHEN "integration"::text = 'notion' THEN 'NOTION'::text
        WHEN "integration"::text = 'gmail' THEN 'GMAIL'::text
        WHEN "integration"::text = 'figma' THEN 'FIGMA'::text
        WHEN "integration"::text = 'confluence' THEN 'CONFLUENCE'::text
        WHEN "integration"::text = 'terse' THEN 'TERSE'::text
        ELSE "integration"::text
    END::"IntegrationType";

-- DropEnum
DROP TYPE "RunHistoryIntegration";
