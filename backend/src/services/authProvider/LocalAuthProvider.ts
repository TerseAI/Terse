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

// Hardcoded IDs for the singleton identity + org. Using fixed IDs makes the
// bootstrap atomic via `upsert` — no race when concurrent first requests hit.
const SINGLETON_IDENTITY_ID = "local-singleton-identity"
const SINGLETON_ORG_ID = "local-singleton-org"

const cookieOptions: CookieOptions = {
    path: "/",
    httpOnly: true,
    secure: settings.nodeEnv === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    ...(settings.optional.cookieDomain ? { domain: settings.optional.cookieDomain } : {})
}

type IdentityRow = { id: string; email: string; display_name: string | null }

export class LocalAuthProvider implements AuthProvider {
    readonly sessionCookieName = SESSION_COOKIE_NAME

    registerRoutes(_app: Express): void {
        // No extra routes — single-user local mode has no login form.
    }

    async getUser(userId: string): Promise<UserProfile | null> {
        await ensureLocalUser()
        const identity = await localAuthDb().local_identities.findUnique({ where: { id: userId } })
        if (!identity) return null
        return identityToProfile(identity)
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
    const username = await readSystemUsername()

    // Atomic singleton bootstrap. Fixed IDs make upsert idempotent across
    // concurrent first requests.
    const identity = await db.local_identities.upsert({
        where: { id: SINGLETON_IDENTITY_ID },
        create: { id: SINGLETON_IDENTITY_ID, email: `${username}@localhost`, display_name: username, created_via: "bootstrap" },
        update: {}
    })
    const org = await db.local_organizations.upsert({
        where: { id: SINGLETON_ORG_ID },
        create: { id: SINGLETON_ORG_ID, name: "Self-Hosted" },
        update: {}
    })
    await db.local_memberships.upsert({
        where: { identity_id_organization_id: { identity_id: identity.id, organization_id: org.id } },
        create: { identity_id: identity.id, organization_id: org.id, roles: "admin" },
        update: {}
    })

    const profile = identityToProfile(identity)
    const user: UserSession = {
        ...profile,
        organizationId: org.id,
        organizationName: org.name,
        roles: ["admin"]
    }
    return { user, profile }
}

function identityToProfile(identity: IdentityRow): UserProfile {
    return {
        id: identity.id,
        email: identity.email,
        displayName: identity.display_name ?? identity.email,
        firstName: null,
        lastName: null,
        displayPhotoUrl: ""
    }
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
