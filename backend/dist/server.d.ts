import 'dotenv/config';
import { User } from './types/prisma.js';
import { User as TicketUser } from './shared/TicketSystem.js';
import { TicketManager } from './ticketing/TicketIntegration.js';
export type Session = {
    user: User;
    ticketManager?: TicketManager;
    isUserInitiated: boolean;
    teamId?: string;
    currentUser?: TicketUser;
};
//# sourceMappingURL=server.d.ts.map