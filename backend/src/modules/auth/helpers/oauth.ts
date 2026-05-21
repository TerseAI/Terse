import crypto from "crypto"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { jwt as jwtConfig, settings } from "../../../settings"

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

export function createOAuthStateToken(options: OAuthStatePayloadOptions): string {
    const { userId, organizationId, additionalFields = {}, additionalStatePayload, expiresIn = "10m", encodeAsUriComponent = false } = options

    // Spread the caller-provided fields first, then the authenticated identity
    // last so userId/organizationId can never be shadowed by a field passed in
    // additionalFields/additionalStatePayload.
    const statePayload: OAuthStatePayload = {
        ...additionalFields,
        ...(additionalStatePayload && typeof additionalStatePayload === "object" ? additionalStatePayload : {}),
        userId,
        organizationId
    }

    const encodedState = jwt.sign(statePayload, jwtConfig.secret, {
        expiresIn: expiresIn as any
    })

    return encodeAsUriComponent ? encodeURIComponent(encodedState) : encodedState
}

export function decodeOAuthStateToken(state: string): OAuthStatePayload {
    return jwt.verify(state, jwtConfig.secret, { algorithms: ["HS256"] }) as OAuthStatePayload
}

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

export function mintOAuthState(req: Request, res: Response, options: OAuthStatePayloadOptions): string {
    if (req.session?.authMethod?.kind === "api_token") {
        return createOAuthStateToken({
            ...options,
            additionalFields: { ...(options.additionalFields ?? {}), cliOrigin: true }
        })
    }

    const nonce = crypto.randomBytes(32).toString("hex")
    res.cookie(OAUTH_STATE_COOKIE_NAME, nonce, getOauthStateCookieOptions())
    return createOAuthStateToken({
        ...options,
        additionalFields: { ...(options.additionalFields ?? {}), nonce }
    })
}

export function verifyOAuthState(req: Request, res: Response, state: string): OAuthStatePayload {
    const cookieNonce = typeof req.cookies?.[OAUTH_STATE_COOKIE_NAME] === "string" ? (req.cookies[OAUTH_STATE_COOKIE_NAME] as string) : undefined
    // Always clear — single-use, regardless of outcome.
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, getOauthStateCookieOptions())

    const payload = decodeOAuthStateToken(state)

    if (payload.cliOrigin === true) {
        return payload
    }

    const jwtNonce = typeof payload.nonce === "string" ? payload.nonce : undefined
    if (!cookieNonce || !jwtNonce || cookieNonce.length !== jwtNonce.length) {
        throw new Error("OAuth state nonce mismatch — possible CSRF or stale flow")
    }
    if (!crypto.timingSafeEqual(Buffer.from(cookieNonce), Buffer.from(jwtNonce))) {
        throw new Error("OAuth state nonce mismatch — possible CSRF or stale flow")
    }
    return payload
}
