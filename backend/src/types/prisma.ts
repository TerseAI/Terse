import {
  users,
  github_repositories,
  linear_api_keys,
  jira_api_keys,
  slack_integrations,
  user_slack_integrations,
  user_github_repositories,
  activity_events,
  ticket_activity_events,
  sub_activity_events,
  sub_activity_commit_associations,
  gmail_integrations,
  automations,
  automation_prompts,
  automation_inputs,
  automation_outputs,
  notion_integrations
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

export type SubActivityEvent = sub_activity_events;

export type SubActivityCommitAssociation = sub_activity_commit_associations;

export type GmailIntegration = gmail_integrations;

export type Automation = automations;

export type AutomationPrompt = automation_prompts;

export type AutomationInput = automation_inputs;

export type AutomationOutput = automation_outputs;

export type NotionIntegration = notion_integrations;

// Extended type for Automation with included relations (for queries with include)
export type AutomationWithRelations = Automation & {
  prompt: AutomationPrompt | null;
  inputs: AutomationInput[];
  output?: AutomationOutput | null;
};

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
  ticket_activity_events,
  sub_activity_events,
  sub_activity_commit_associations,
  gmail_integrations,
  automations,
  automation_prompts,
  automation_inputs,
  automation_outputs,
  notion_integrations
}; 