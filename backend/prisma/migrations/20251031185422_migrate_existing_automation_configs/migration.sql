-- Data migration: Populate automation config tables from existing integration records

-- Migrate Notion configs for inputs
INSERT INTO automation_notion_configs (id, automation_input_id, automation_output_id, database_id, database_name, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  ai.id as automation_input_id,
  NULL as automation_output_id,
  ni.database_id,
  ni.database_name,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_inputs ai
INNER JOIN notion_integrations ni ON ai.integration_id = ni.id
WHERE ai.integration_type = 'NOTION'
  AND NOT EXISTS (
    SELECT 1 FROM automation_notion_configs anc WHERE anc.automation_input_id = ai.id
  );

-- Migrate Notion configs for outputs
INSERT INTO automation_notion_configs (id, automation_input_id, automation_output_id, database_id, database_name, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  NULL as automation_input_id,
  ao.id as automation_output_id,
  ni.database_id,
  ni.database_name,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_outputs ao
INNER JOIN notion_integrations ni ON ao.integration_id = ni.id
WHERE ao.integration_type = 'NOTION'
  AND NOT EXISTS (
    SELECT 1 FROM automation_notion_configs anc WHERE anc.automation_output_id = ao.id
  );

-- Migrate Linear configs for inputs
INSERT INTO automation_linear_configs (id, automation_input_id, automation_output_id, project_id, project_name, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  ai.id as automation_input_id,
  NULL as automation_output_id,
  lak.team_id as project_id,
  lak.team_name as project_name,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_inputs ai
INNER JOIN linear_api_keys lak ON ai.integration_id = lak.id
WHERE ai.integration_type = 'LINEAR'
  AND NOT EXISTS (
    SELECT 1 FROM automation_linear_configs alc WHERE alc.automation_input_id = ai.id
  );

-- Migrate Linear configs for outputs
INSERT INTO automation_linear_configs (id, automation_input_id, automation_output_id, project_id, project_name, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  NULL as automation_input_id,
  ao.id as automation_output_id,
  lak.team_id as project_id,
  lak.team_name as project_name,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_outputs ao
INNER JOIN linear_api_keys lak ON ao.integration_id = lak.id
WHERE ao.integration_type = 'LINEAR'
  AND NOT EXISTS (
    SELECT 1 FROM automation_linear_configs alc WHERE alc.automation_output_id = ao.id
  );

-- Migrate Jira configs for inputs
INSERT INTO automation_jira_configs (id, automation_input_id, automation_output_id, project_key, project_id, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  ai.id as automation_input_id,
  NULL as automation_output_id,
  jak.project_key,
  NULL as project_id,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_inputs ai
INNER JOIN jira_api_keys jak ON ai.integration_id = jak.id
WHERE ai.integration_type = 'JIRA'
  AND NOT EXISTS (
    SELECT 1 FROM automation_jira_configs ajc WHERE ajc.automation_input_id = ai.id
  );

-- Migrate Jira configs for outputs
INSERT INTO automation_jira_configs (id, automation_input_id, automation_output_id, project_key, project_id, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  NULL as automation_input_id,
  ao.id as automation_output_id,
  jak.project_key,
  NULL as project_id,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_outputs ao
INNER JOIN jira_api_keys jak ON ao.integration_id = jak.id
WHERE ao.integration_type = 'JIRA'
  AND NOT EXISTS (
    SELECT 1 FROM automation_jira_configs ajc WHERE ajc.automation_output_id = ao.id
  );

-- Migrate GitHub configs for inputs
-- Note: For GitHub, integration_id is the github_repository_id
INSERT INTO automation_github_configs (id, automation_input_id, automation_output_id, repository_id, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  ai.id as automation_input_id,
  NULL as automation_output_id,
  gr.id as repository_id,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_inputs ai
INNER JOIN github_repositories gr ON ai.integration_id = gr.id
WHERE ai.integration_type = 'GITHUB'
  AND NOT EXISTS (
    SELECT 1 FROM automation_github_configs agc WHERE agc.automation_input_id = ai.id
  );

-- Migrate GitHub configs for outputs
INSERT INTO automation_github_configs (id, automation_input_id, automation_output_id, repository_id, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  NULL as automation_input_id,
  ao.id as automation_output_id,
  gr.id as repository_id,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_outputs ao
INNER JOIN github_repositories gr ON ao.integration_id = gr.id
WHERE ao.integration_type = 'GITHUB'
  AND NOT EXISTS (
    SELECT 1 FROM automation_github_configs agc WHERE agc.automation_output_id = ao.id
  );

-- Migrate Slack configs for inputs (empty configs - channel_id will be set per automation)
INSERT INTO automation_slack_configs (id, automation_input_id, automation_output_id, channel_id, channel_name, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  ai.id as automation_input_id,
  NULL as automation_output_id,
  NULL as channel_id,
  NULL as channel_name,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_inputs ai
WHERE ai.integration_type = 'SLACK'
  AND NOT EXISTS (
    SELECT 1 FROM automation_slack_configs as_config WHERE as_config.automation_input_id = ai.id
  );

-- Migrate Slack configs for outputs (empty configs - channel_id will need to be set)
INSERT INTO automation_slack_configs (id, automation_input_id, automation_output_id, channel_id, channel_name, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  NULL as automation_input_id,
  ao.id as automation_output_id,
  NULL as channel_id,
  NULL as channel_name,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_outputs ao
WHERE ao.integration_type = 'SLACK'
  AND NOT EXISTS (
    SELECT 1 FROM automation_slack_configs as_config WHERE as_config.automation_output_id = ao.id
  );

-- Migrate Gmail configs for inputs (empty configs for now)
INSERT INTO automation_gmail_configs (id, automation_input_id, automation_output_id, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  ai.id as automation_input_id,
  NULL as automation_output_id,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_inputs ai
WHERE ai.integration_type = 'GMAIL'
  AND NOT EXISTS (
    SELECT 1 FROM automation_gmail_configs agc WHERE agc.automation_input_id = ai.id
  );

-- Migrate Gmail configs for outputs (empty configs for now)
INSERT INTO automation_gmail_configs (id, automation_input_id, automation_output_id, created_at, updated_at)
SELECT 
  gen_random_uuid()::text as id,
  NULL as automation_input_id,
  ao.id as automation_output_id,
  NOW() as created_at,
  NOW() as updated_at
FROM automation_outputs ao
WHERE ao.integration_type = 'GMAIL'
  AND NOT EXISTS (
    SELECT 1 FROM automation_gmail_configs agc WHERE agc.automation_output_id = ao.id
  );
