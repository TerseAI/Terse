import jwt from "jsonwebtoken"

import { jwt as jwtConfig } from "../config/settings"

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
    return jwt.verify(state, jwtConfig.secret, { algorithms: ["HS256"] }) as OAuthStatePayload
}
