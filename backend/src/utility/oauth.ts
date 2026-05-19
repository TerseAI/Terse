import crypto from "crypto"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { jwt as jwtConfig, settings } from "../config/settings"

/**
 * OAuth state payload structure (decoded state token)
 * This represents the structure of the state payload used in OAuth flows
 * Generic type that can contain any fields - specific fields are added at runtime
 */
export interface OAuthStatePayload {
    /**
     * User ID (required)
     */
    userId: string

    /**
     * JWT standard claims (added by jwt.sign)
     */
    exp?: number
    iat?: number
    nbf?: number

    /**
     * Additional dynamic fields from additionalFields or additionalStatePayload
     */
    [key: string]: any
}

export interface OAuthStatePayloadOptions {
    /**
     * User ID (required)
     */
    userId: string

    /**
     * Organization ID (required)
     */
    organizationId: string

    /**
     * Additional fields to include in the state payload (e.g., isBotUser, timestamp)
     */
    additionalFields?: Record<string, any>

    /**
     * Additional state payload variables to merge (e.g., chat metadata)
     */
    additionalStatePayload?: Record<string, string>

    /**
     * JWT expiration time (default: "10m")
     */
    expiresIn?: string

    /**
     * Whether to encode the token as URI component (default: false)
     */
    encodeAsUriComponent?: boolean
}

/**
 * Creates an OAuth state token signed as a JWT.
 *
 * State is always JWT-signed — unsigned encodings are not supported because
 * an unsigned state lets an attacker forge userId/organizationId in the callback,
 * binding their OAuth account to a victim's tenant.
 *
 * NOTE: Signing alone does NOT prevent CSRF account hijacking. A signed state
 * minted for user A can be embedded into a victim's OAuth flow, causing the
 * victim's tokens to be stored under user A's account. For browser-initiated
 * OAuth flows, use {@link mintBrowserOAuthState} + {@link verifyOAuthState}
 * instead — these bind the state to a single-use cookie nonce.
 */
export function createOAuthStateToken(options: OAuthStatePayloadOptions): string {
    const { userId, organizationId, additionalFields = {}, additionalStatePayload, expiresIn = "10m", encodeAsUriComponent = false } = options

    const statePayload: OAuthStatePayload = {
        userId,
        organizationId,
        ...additionalFields
    }

    if (additionalStatePayload && typeof additionalStatePayload === "object") {
        Object.assign(statePayload, additionalStatePayload)
    }

    const encodedState = jwt.sign(statePayload, jwtConfig.secret, {
        expiresIn: expiresIn as any
    })

    return encodeAsUriComponent ? encodeURIComponent(encodedState) : encodedState
}

/**
 * Decodes and verifies an OAuth state token. Throws if the signature is
 * invalid or the token has expired — there is no unsigned fallback.
 */
export function decodeOAuthStateToken(state: string): OAuthStatePayload {
    return jwt.verify(state, jwtConfig.secret) as OAuthStatePayload
}

// ============================================================================
// Cookie-bound OAuth state (CSRF protection)
// ============================================================================

const OAUTH_STATE_COOKIE_NAME = "TERSE_INTEGRATION_OAUTH_STATE"
const TEN_MINUTES_MS = 10 * 60 * 1000

function getOauthStateCookieOptions() {
    const base = {
        path: "/",
        httpOnly: true,
        secure: settings.nodeEnv === "production",
        sameSite: "lax" as const,
        maxAge: TEN_MINUTES_MS
    }
    return settings.optional.cookieDomain ? { ...base, domain: settings.optional.cookieDomain } : base
}

/**
 * Browser-initiated OAuth state: binds the JWT state to a single-use nonce
 * stored in an HttpOnly SameSite=Lax cookie. The callback must call
 * {@link verifyOAuthState} to validate that the cookie nonce matches the
 * embedded JWT nonce, preventing CSRF account-hijacking attacks where an
 * attacker mints a valid state for themselves and tricks a victim into
 * completing the OAuth flow against it.
 *
 * Mirrors the WorkOS login pattern in routes/auth.ts.
 */
export function mintBrowserOAuthState(res: Response, options: OAuthStatePayloadOptions): string {
    const nonce = crypto.randomBytes(32).toString("hex")
    res.cookie(OAUTH_STATE_COOKIE_NAME, nonce, getOauthStateCookieOptions())
    return createOAuthStateToken({
        ...options,
        additionalFields: { ...(options.additionalFields ?? {}), nonce }
    })
}

/**
 * Verifies an OAuth state token at the callback. Single-use: the cookie is
 * cleared regardless of outcome. Throws if the JWT is invalid/expired or if
 * the embedded nonce does not match the cookie — there is no escape hatch.
 */
export function verifyOAuthState(req: Request, res: Response, state: string): OAuthStatePayload {
    const cookieNonce = typeof req.cookies?.[OAUTH_STATE_COOKIE_NAME] === "string" ? (req.cookies[OAUTH_STATE_COOKIE_NAME] as string) : undefined
    // Always clear — single-use, regardless of outcome.
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, getOauthStateCookieOptions())

    const payload = decodeOAuthStateToken(state)
    const jwtNonce = typeof payload.nonce === "string" ? payload.nonce : undefined
    if (!cookieNonce || !jwtNonce || cookieNonce.length !== jwtNonce.length) {
        throw new Error("OAuth state nonce mismatch — possible CSRF or stale flow")
    }
    if (!crypto.timingSafeEqual(Buffer.from(cookieNonce), Buffer.from(jwtNonce))) {
        throw new Error("OAuth state nonce mismatch — possible CSRF or stale flow")
    }
    return payload
}
