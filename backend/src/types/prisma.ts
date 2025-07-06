import { users, github_repositories, linear_api_keys } from '../generated/prisma';

  
  // PascalCase aliases
  export type User = users;

  export type GithubRepository = github_repositories;

  export type LinearApiKey = linear_api_keys;

  // Re-export the original types too
  export {
    users,
    github_repositories,
    linear_api_keys,
  }; 