import 'dotenv/config';
import { User } from './types/prisma.js';
import { TicketManager } from './ticketing/TicketIntegration.js';
export type Session = {
    user: User;
    ticketManager?: TicketManager;
    isUserInitiated: boolean;
    teamId?: string;
};
//# sourceMappingURL=server.d.ts.map