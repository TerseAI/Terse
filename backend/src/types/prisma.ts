import { users, github_repositories, linear_api_keys, slack_integrations, user_slack_integrations } from '../generated/prisma';

  
  // PascalCase aliases
  export type User = users;

  export type GithubRepository = github_repositories;

  export type LinearApiKey = linear_api_keys;

  export type SlackIntegration = slack_integrations;

  export type UserSlackIntegration = user_slack_integrations;

  // Re-export the original types too
  export {
    users,
    github_repositories,
    linear_api_keys,
    slack_integrations,
    user_slack_integrations,
  }; 