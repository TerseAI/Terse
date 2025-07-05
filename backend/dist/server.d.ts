import 'dotenv/config';
import { User } from './types/prisma';
import { TicketManager } from './ticketing/TicketIntegration';
export type Session = {
    user: User;
    ticketManager?: TicketManager;
    isUserInitiated: boolean;
    teamId?: string;
};
//# sourceMappingURL=server.d.ts.map