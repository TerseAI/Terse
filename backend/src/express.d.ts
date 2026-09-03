// Define a session type that matches what we're actually using in auth
import type { TokenKind } from "@prisma/client"
import type { UserSession } from "terse-types/types"

export type AuthMethod = { kind: "cookie" } | { kind: "api_token"; tokenKind: TokenKind; projectId: string | null }

export type Session = {
    user: UserSession
    authMethod?: AuthMethod
}

declare global {
    namespace Express {
        interface Request {
            session?: Session
        }
    }
}
