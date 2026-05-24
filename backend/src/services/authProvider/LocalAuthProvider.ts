import { exec } from "child_process"
import { CookieOptions, Express, Request, Response } from "express"
import { JWTPayload } from "jose"
import { UserProfile, UserSession } from "terse-types/types"
import { promisify } from "util"

import logger from "../../common/logger"
import { localAuthDb } from "../../loaders/prisma"
import { settings } from "../../settings"

import AuthProvider, { CookieAuthOutcome } from "./AuthProvider"

const execAsync = promisify(exec)
const SESSION_COOKIE_NAME = "TERSE_LOCAL_SESSION"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const cookieOptions: CookieOptions = {
    path: "/",
    httpOnly: true,
    secure: settings.nodeEnv === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    ...(settings.optional.cookieDomain ? { domain: settings.optional.cookieDomain } : {})
}

export class LocalAuthProvider implements AuthProvider {
    readonly sessionCookieName = SESSION_COOKIE_NAME

    registerRoutes(_app: Express): void {
        // No extra routes — single-user local mode has no login form.
    }

    async getUser(_userId: string): Promise<UserProfile | null> {
        const { profile } = await ensureLocalUser()
        return profile
    }

    async verifyJWT(_token: string): Promise<JWTPayload> {
        // Local mode doesn't issue JWTs; bearer-token paths fall through to the single user.
        // org_id is needed so the socket joins the org room and receives invalidations.
        const { user } = await ensureLocalUser()
        return { sub: user.id, org_id: user.organizationId, sid: "local" }
    }

    async login(_req: Request, res: Response): Promise<void> {
        ensureCookie(res)
        res.redirect("/")
    }

    async loginUrl(_req: Request, res: Response): Promise<void> {
        res.json({ loginUrl: "/" })
    }

    async logoutUrl(_req: Request, res: Response): Promise<void> {
        res.clearCookie(SESSION_COOKIE_NAME, cookieOptions)
        res.json({ logoutUrl: "/" })
    }

    async logout(_req: Request, res: Response): Promise<void> {
        res.clearCookie(SESSION_COOKIE_NAME, cookieOptions)
        res.redirect("/")
    }

    async me(req: Request, res: Response): Promise<void> {
        const user = req.session?.user ?? (await ensureLocalUser()).user
        res.json(user)
    }

    async callback(req: Request, _res: Response): Promise<void> {
        logger.debug("[LocalAuthProvider.callback] no-op", { path: req.path })
    }

    async authenticateViaCookie(_sealedSessionData: string | undefined, _req: Request, res: Response): Promise<CookieAuthOutcome> {
        const { user } = await ensureLocalUser()
        ensureCookie(res)
        return { ok: true, user }
    }

    async requestSessionSocketToken(_req: Request, res: Response): Promise<void> {
        const { user } = await ensureLocalUser()
        res.json({ token: user.id })
    }
}

// ─────────────── helpers ───────────────

async function ensureLocalUser(): Promise<{ user: UserSession; profile: UserProfile }> {
    const db = localAuthDb()
    let identity = await db.local_identities.findFirst()
    if (!identity) {
        const username = await readSystemUsername()
        identity = await db.local_identities.create({
            data: { email: `${username}@localhost`, display_name: username, created_via: "bootstrap" }
        })
    }
    let org = await db.local_organizations.findFirst()
    if (!org) {
        org = await db.local_organizations.create({ data: { name: "Self-Hosted" } })
    }
    await db.local_memberships.upsert({
        where: { identity_id_organization_id: { identity_id: identity.id, organization_id: org.id } },
        create: { identity_id: identity.id, organization_id: org.id, roles: "admin" },
        update: {}
    })

    const profile: UserProfile = {
        id: identity.id,
        email: identity.email,
        displayName: identity.display_name ?? identity.email,
        firstName: null,
        lastName: null,
        displayPhotoUrl: ""
    }
    const user: UserSession = {
        ...profile,
        organizationId: org.id,
        organizationName: org.name,
        roles: ["admin"]
    }
    return { user, profile }
}

async function readSystemUsername(): Promise<string> {
    try {
        const { stdout } = await execAsync("whoami")
        return stdout.trim() || "local"
    } catch {
        return "local"
    }
}

function ensureCookie(res: Response): void {
    res.cookie(SESSION_COOKIE_NAME, "local", cookieOptions)
}
