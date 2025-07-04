import { users } from '../generated/prisma';

  
  // PascalCase aliases
  export type User = users;

  // Re-export the original types too
  export {
    users,
  }; 