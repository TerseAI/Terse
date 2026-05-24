import { Express, Request, Response } from "express"
import { JWTPayload } from "jose"
import { UserSession } from "terse-types/types"

import AuthProvider, { CookieAuthOutcome } from "./AuthProvider"

export class LocalAuthProvider implements AuthProvider {
    getWorkOSWidgetToken(req: Request, res: Response): Promise<void> {
        throw new Error("Method not implemented.")
    }
    requestSessionSocketToken(req: Request, res: Response): Promise<void> {
        throw new Error("Method not implemented.")
    }
    registerRoutes?(app: Express): void {
        throw new Error("Method not implemented.")
    }
    async getUser(userId: string): Promise<UserSession | null> {
        return null
    }

    async verifyJWT(token: string): Promise<JWTPayload> {
        throw new Error("Not implemented")
    }

    async login(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async loginUrl(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async logoutUrl(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async logout(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async me(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async callback(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async authenticateViaCookie(sealedSessionData: string | undefined, req: Request, res: Response): Promise<CookieAuthOutcome> {
        const { email, password } = req.body

        return { ok: false, reason: "no_cookie" }
    }
}
