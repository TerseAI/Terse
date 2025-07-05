import 'dotenv/config';
import { User } from './types/prisma.js';
import { TicketIntegration } from './ticketing/TicketIntegration.js';
export type Session = {
    user: User;
    ticketManager?: TicketIntegration;
    isUserInitiated: boolean;
};
//# sourceMappingURL=server.d.ts.map