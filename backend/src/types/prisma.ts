import { users, github_repositories, linear_api_keys, jira_api_keys, slack_integrations, user_slack_integrations, user_github_repositories } from '../generated/prisma';

  
  // PascalCase aliases
  export type User = users;

  export type GithubRepository = github_repositories;

  export type LinearApiKey = linear_api_keys;
  
  export type JiraApiKey = jira_api_keys;

  export type SlackIntegration = slack_integrations;

  export type UserSlackIntegration = user_slack_integrations;

  export type UserGithubRepository = user_github_repositories;

  // Re-export the original types too
  export {
    users,
    github_repositories,
    linear_api_keys,
    jira_api_keys,
    slack_integrations,
    user_slack_integrations,
    user_github_repositories
  }; 