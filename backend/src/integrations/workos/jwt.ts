import { JWTPayload, jwtVerify } from "jose"

import { workos } from "./helpers"

export class WorkosTokenError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message)
        this.name = "WorkosTokenError"
    }
}

/**
 * Verify a WorkOS-issued JWT (access token, socket auth token) against the
 * WorkOS JWKS. Pins `algorithms: ["RS256"]` so future JWKS changes that add
 * weaker algorithms can't silently downgrade the verification.
 *
 * The JWKS itself is fetched and cached by the WorkOS SDK
 * (via jose's createRemoteJWKSet under the hood), so repeated calls are
 * cheap after the first.
 */
export async function verifyWorkosJwt(token: string): Promise<JWTPayload> {
    const jwks = await workos.userManagement.getJWKS()
    if (!jwks) {
        throw new WorkosTokenError(500, "WorkOS JWKS unavailable")
    }
    const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256"] })
    return payload
}
