// Define a session type that matches what we're actually using in auth
import type { User } from "terse-types/types"

export type Session = {
    user: User
}

declare global {
    namespace Express {
        interface Request {
            session?: Session
        }
    }
}
