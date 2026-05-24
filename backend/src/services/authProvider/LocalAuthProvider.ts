import { Request, Response } from "express"

import AuthProvider, { CookieAuthOutcome } from "./AuthProvider"

export class LocalAuthProvider implements AuthProvider {
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
