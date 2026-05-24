import { AuthenticateWithSessionCookieSuccessResponse } from "@workos-inc/node"
import { JWTPayload } from "jose"

export interface AccessTokenClaims {
    orgName: string
}

/**
 * Extract the custom org_name JWT-template claim from a sealed-session
 * authentication result.
 *
 * Safety: the input type can only be constructed by `WorkOS.userManagement
 * .loadSealedSession(...).authenticate()` returning `{ authenticated: true }`,
 * which has already verified the sealed session and the embedded access token.
 * Callers cannot fabricate this from an untrusted string.
 */
export function getClaimsFromAuthResult(authResult: AuthenticateWithSessionCookieSuccessResponse): AccessTokenClaims | null {
    return decodePayloadFromVerifiedToken(authResult.accessToken)
}

/**
 * Extract the org_name claim from a JWT payload that has already been
 * signature-verified — e.g. the `payload` returned by `jose.jwtVerify(token,
 * jwks)` against the WorkOS JWKS.
 */
export function getClaimsFromVerifiedPayload(payload: JWTPayload): AccessTokenClaims | null {
    return readClaims(payload.org_name)
}

function decodePayloadFromVerifiedToken(verifiedAccessToken: string): AccessTokenClaims | null {
    try {
        const parts = verifiedAccessToken.split(".")
        if (parts.length !== 3) return null
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString())
        return readClaims(payload.org_name)
    } catch {
        return null
    }
}

function readClaims(orgName: unknown): AccessTokenClaims | null {
    if (typeof orgName !== "string") return null
    return { orgName }
}
