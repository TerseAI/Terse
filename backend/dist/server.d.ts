import 'dotenv/config';
import { User } from './types/prisma';
import { User as TicketUser } from './shared/TicketSystem';
import { TicketManager } from './ticketing/TicketIntegration';
export type Session = {
    user: User;
    ticketManager?: TicketManager;
    isUserInitiated: boolean;
    teamId?: string;
    currentUser?: TicketUser;
};
//# sourceMappingURL=server.d.ts.map