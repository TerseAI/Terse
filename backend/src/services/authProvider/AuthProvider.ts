import { Request, Response } from "express"
import { User } from "terse-types/types"

export interface AuthProvider {
    // MARK: Network Endpoints
    login(_req: Request, res: Response): Promise<void>
    loginUrl(_req: Request, res: Response): Promise<void>
    logoutUrl(req: Request, res: Response): Promise<void>
    logout(req: Request, res: Response): Promise<void>
    me(req: Request, res: Response): Promise<void>
    callback(req: Request, res: Response): Promise<void>

    // Middleware
    authenticateViaCookie(sealedSessionData: string | undefined, req: Request, res: Response): Promise<CookieAuthOutcome>
}

// helper types
export type CookieAuthOutcome = { ok: true; user: User } | { ok: false; reason: "no_cookie" | "auth_failed" }

export default AuthProvider
