import { Request } from 'express';
import { SanitizedUser } from './types';
import { Organization } from './prisma';

// Define a session type that matches what we're actually using in auth

export type Session = {
  user: User;
  ticketManager?: TicketManager;
  isUserInitiated: boolean; // true if the user has initiated the session, false if the session was initiated by the system
  teamId?: string;
  currentUser?: TicketUser;
}

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}