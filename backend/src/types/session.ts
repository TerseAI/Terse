import { User } from "./prisma";
import { User as TicketUser } from "../shared/TicketSystem";

export type Session = {
    user: User;
    isUserInitiated: boolean; // true if the user has initiated the session, false if the session was initiated by the system
    teamId?: string;
    currentUser?: TicketUser;
};
