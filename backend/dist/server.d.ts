import 'dotenv/config';
import { User } from './types/prisma';
import { TicketIntegration } from './ticketing/TicketIntegration';
export type Session = {
    user: User;
    ticketManager?: TicketIntegration;
    isUserInitiated: boolean;
};
//# sourceMappingURL=server.d.ts.map