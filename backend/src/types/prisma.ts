import {
  users,
  github_repositories,
  linear_api_keys,
  jira_api_keys,
  slack_integrations,
  user_slack_integrations,
  user_github_repositories,
  activity_events,
  ticket_activity_events
} from '@prisma/client';


// PascalCase aliases
export type User = users;

export type GithubRepository = github_repositories;

export type LinearApiKey = linear_api_keys;

export type JiraApiKey = jira_api_keys;

export type SlackIntegration = slack_integrations;

export type UserSlackIntegration = user_slack_integrations;

export type UserGithubRepository = user_github_repositories;

export type ActivityEvent = activity_events;

export type TicketActivityEvent = ticket_activity_events;

// Re-export the original types too
export {
  users,
  github_repositories,
  linear_api_keys,
  jira_api_keys,
  slack_integrations,
  user_slack_integrations,
  user_github_repositories,
  activity_events,
  ticket_activity_events
}; 