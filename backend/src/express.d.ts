import { Request } from 'express';
import { SanitizedUser } from './types';
import { Organization } from './prisma';

// Define a session type that matches what we're actually using in auth
type Session = {
  user: SanitizedUser;
}

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}