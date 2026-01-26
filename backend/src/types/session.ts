import { User } from "./prisma";
import { TicketManager } from "../ticketing/TicketIntegration";
import { User as TicketUser } from "../shared/TicketSystem";

export type Session = {
    user: User;
    ticketManager?: TicketManager;
    isUserInitiated: boolean; // true if the user has initiated the session, false if the session was initiated by the system
    teamId?: string;
    currentUser?: TicketUser;
};
