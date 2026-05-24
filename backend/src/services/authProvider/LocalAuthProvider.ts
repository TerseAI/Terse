import { Express, Request, Response } from "express"
import { JWTPayload } from "jose"
import { UserProfile } from "terse-types/types"

import logger from "../../common/logger"

import AuthProvider, { CookieAuthOutcome } from "./AuthProvider"

export class LocalAuthProvider implements AuthProvider {
    readonly sessionCookieName = "TERSE_LOCAL_SESSION"

    registerRoutes(_app: Express): void {
        // TODO: register POST /auth/local/login, POST /auth/local/register, etc.
    }

    requestSessionSocketToken(_req: Request, _res: Response): Promise<void> {
        throw new Error("Method not implemented.")
    }

    async getUser(_userId: string): Promise<UserProfile | null> {
        return null
    }

    async verifyJWT(_token: string): Promise<JWTPayload> {
        throw new Error("Not implemented")
    }

    async login(_req: Request, _res: Response): Promise<void> {
        // TODO: render / handle the local login form
    }

    async loginUrl(_req: Request, _res: Response): Promise<void> {
        // TODO: return the local-login URL
    }

    async logoutUrl(_req: Request, _res: Response): Promise<void> {
        // TODO: return the local-logout URL (or null for "just clear cookie")
    }

    async logout(_req: Request, _res: Response): Promise<void> {
        // TODO: clear the session cookie
    }

    async me(_req: Request, _res: Response): Promise<void> {
        // TODO: return req.session.user as UserSession
    }

    async callback(req: Request, _res: Response): Promise<void> {
        // Local has no redirect-based callback; the login form submission completes auth directly.
        logger.debug("[LocalAuthProvider.callback] no-op", { path: req.path })
    }

    async authenticateViaCookie(_sealedSessionData: string | undefined, _req: Request, _res: Response): Promise<CookieAuthOutcome> {
        return { ok: false, reason: "no_cookie" }
    }
}
