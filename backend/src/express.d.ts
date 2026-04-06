// Define a session type that matches what we're actually using in auth
import type { User } from "terse-types/types"

export type Session = {
    user: User
    isUserInitiated: boolean // true if the user has initiated the session, false if the session was initiated by the system
    teamId?: string
}

declare global {
    namespace Express {
        interface Request {
            session?: Session
        }
    }
}
