import { users, github_repositories } from '../generated/prisma';

  
  // PascalCase aliases
  export type User = users;

  export type GithubRepository = github_repositories;

  // Re-export the original types too
  export {
    users,
    github_repositories,
  }; 