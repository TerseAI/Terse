import jwt from "jsonwebtoken"

import { jwt as jwtConfig } from "../config/settings"
import { settings } from "../config/settings"

/**
 * Cached metadata that is NOT available from the WorkOS sealed session auth result.
 * Stored in a JWT cookie so we can reconstruct the full User object without
 * hitting the database or WorkOS API on every request.
 */
export interface CachedUserMeta {
    dbId: string
    orgName: string
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const USER_META_COOKIE_NAME = "TERSE_USER_META"

const userMetaCookieBaseOptions = {
    path: "/",
    httpOnly: true,
    secure: settings.nodeEnv === "production",
    sameSite: "lax" as const,
    maxAge: SEVEN_DAYS_MS
}

export const USER_META_COOKIE_OPTIONS = settings.optional.cookieDomain ? { ...userMetaCookieBaseOptions, domain: settings.optional.cookieDomain } : userMetaCookieBaseOptions

export function signUserMeta(meta: CachedUserMeta): string {
    return jwt.sign({ dbId: meta.dbId, orgName: meta.orgName }, jwtConfig.secret, {
        expiresIn: "7d"
    })
}

export function verifyUserMeta(token: string): CachedUserMeta | null {
    try {
        const decoded = jwt.verify(token, jwtConfig.secret) as CachedUserMeta
        if (!decoded.dbId || typeof decoded.dbId !== "string") return null
        if (typeof decoded.orgName !== "string") return null
        return { dbId: decoded.dbId, orgName: decoded.orgName }
    } catch {
        return null
    }
}
