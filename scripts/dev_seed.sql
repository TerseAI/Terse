
-- users
INSERT INTO users (id, email, display_name, github_username, created_at, updated_at, is_placeholder)
VALUES ('c2b33782008d04be39e4eec89', 'thomas.karatzas@mail.mcgill.ca', 'Thomas Karatzas', 'tkaratzas', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483', false);

-- github_repositories
INSERT INTO github_repositories (id, name, owner, installation_id, created_at, updated_at)
VALUES ('c90e3780248624cbc90cca1a6', 'vectra-core', 'vectra-ai', 123456, '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- user_github_repositories
INSERT INTO user_github_repositories (id, user_id, github_repository_id, created_at, updated_at)
VALUES ('c2b89190c647b425cb3958078', 'c2b33782008d04be39e4eec89', 'c90e3780248624cbc90cca1a6', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- linear_api_keys
INSERT INTO linear_api_keys (id, user_id, linear_user_id, api_key, webhook_secret, webhook_id, created_at, updated_at)
VALUES ('c2d95075dd170426fbea5e7fc', 'c2b33782008d04be39e4eec89', 'lin_abc123', 'key_abc123', 'secret123', 'hook123', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- slack_integrations
INSERT INTO slack_integrations (id, app_id, scope, access_token, bot_user_id, team_id, team_name, created_at, updated_at)
VALUES ('c419c126085824dd595108d4d', 'A01APPID', '', 'xoxb-token', 'U01BOTUSER', 'T01TEAMID', 'Vectra Team', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- user_slack_integrations
INSERT INTO user_slack_integrations (id, user_id, slack_team_id, dm_channel_id, authed_user_id, created_at, updated_at)
VALUES ('c243dd7255265473db4e73869', 'c2b33782008d04be39e4eec89', 'T01TEAMID', 'D01CHANNELID', 'U01AUTHEDUSER', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- jira_api_keys
INSERT INTO jira_api_keys (id, user_id, jira_user_email, base_url, webhook_id, api_token, created_at, updated_at)
VALUES ('c643bb96fa8b04610b839a97a', 'c2b33782008d04be39e4eec89', 'thomas.karatzas@mail.mcgill.ca', 'https://vectra.atlassian.net', 'jira_hook_123', 'jira_token_abc', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- activity_events
INSERT INTO activity_events (id, user_id, title, event_type, github_repository_id, created_at, updated_at)
VALUES ('c3fc1b63a11344dccabc4929d', 'c2b33782008d04be39e4eec89', 'PR opened on vectra-core', 'PULL_REQUEST_OPENED', 'c90e3780248624cbc90cca1a6', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483');

-- sub_activity_events
INSERT INTO sub_activity_events (id, summary, created_at, updated_at, activity_event_id)
VALUES ('c232b9f48dbb447888b7a25e0', 'Opened pull request to add caching', '2025-08-04 22:51:07.339483', '2025-08-04 22:56:07.339483', 'c3fc1b63a11344dccabc4929d');

-- sub_activity_commit_associations
INSERT INTO sub_activity_commit_associations (id, commit_sha, commit_message, commit_url, created_at, sub_activity_event_id)
VALUES ('c763a9b0c3a384f039ac52644', 'abc123def456', 'Add caching to summary generation', 'https://github.com/vectra-ai/vectra-core/commit/abc123def456', '2025-08-04 22:51:07.339483', 'c232b9f48dbb447888b7a25e0');
