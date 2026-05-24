import { Express, Request, Response } from "express"
import { JWTPayload } from "jose"
import { UserProfile, UserSession } from "terse-types/types"

export interface AuthProvider {
    // User_Id Resolving
    getUser(userId: string): Promise<UserProfile | null>
    verifyJWT(token: string): Promise<JWTPayload>

    // MARK: Network Endpoints
    login(req: Request, res: Response): Promise<void>
    loginUrl(req: Request, res: Response): Promise<void>
    logoutUrl(req: Request, res: Response): Promise<void>
    logout(req: Request, res: Response): Promise<void>
    me(req: Request, res: Response): Promise<void>
    callback(req: Request, res: Response): Promise<void>

    // Middleware
    authenticateViaCookie(sealedSessionData: string | undefined, req: Request, res: Response): Promise<CookieAuthOutcome>

    // Widget Token
    getWorkOSWidgetToken(req: Request, res: Response): Promise<void>

    // Socket Tokens
    requestSessionSocketToken(req: Request, res: Response): Promise<void>

    // Optional: Allow AuthProvider to register Routes
    registerRoutes?(app: Express): void
}

// helper types
export type CookieAuthOutcome = { ok: true; user: UserSession } | { ok: false; reason: "no_cookie" | "auth_failed" }

export class AuthTokenError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message)
        this.name = "AuthTokenError"
    }
}

export default AuthProvider
