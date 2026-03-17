export interface AccessTokenClaims {
    dbId: string
    orgName: string
}

/**
 * Decode custom claims from a WorkOS access token (JWT).
 * The token is already verified by the sealed session — we only need to read the payload.
 * Returns null if claims are missing (e.g., JWT Template not configured, or user metadata not yet backfilled).
 */
export function decodeAccessTokenClaims(accessToken: string): AccessTokenClaims | null {
    try {
        const parts = accessToken.split(".")
        if (parts.length !== 3) return null

        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString())
        const dbId = payload.db_id
        const orgName = payload.org_name

        if (typeof dbId !== "string" || !dbId) return null
        if (typeof orgName !== "string") return null

        return { dbId, orgName }
    } catch {
        return null
    }
}
