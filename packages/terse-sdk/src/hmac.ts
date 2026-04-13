import crypto from "node:crypto"
import { TERSE_SIGNATURE_HEADER, TERSE_SIGNATURE_VERSION, TERSE_TIMESTAMP_HEADER } from "terse-types"

const MAX_TIMESTAMP_AGE_SECONDS = 300

function computeRequestSignature(signingSecret: string, timestamp: number, body: string): string {
    const baseString = `${TERSE_SIGNATURE_VERSION}:${timestamp}:${body}`
    const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex")
    return `${TERSE_SIGNATURE_VERSION}=${hmac}`
}

function verifyRequestSignature(signingSecret: string, signature: string, timestamp: number, body: string): boolean {
    const expected = computeRequestSignature(signingSecret, timestamp, body)
    if (signature.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/** Compute the HMAC-SHA256 of a challenge token using the signing secret. */
export function computeChallengeSignature(signingSecret: string, challengeToken: string): string {
    return crypto.createHmac("sha256", signingSecret).update(challengeToken).digest("hex")
}

/**
 * Verify an incoming Terse request signature. Throws if invalid or missing.
 * Useful both internally and as a public export for custom middleware.
 */
export function verifyIncomingRequest(signingSecret: string, headers: Record<string, string | string[] | undefined>, rawBody: string): void {
    const signature = headers[TERSE_SIGNATURE_HEADER]
    const timestampStr = headers[TERSE_TIMESTAMP_HEADER]
    if (typeof signature !== "string" || typeof timestampStr !== "string") {
        const missing = [
            typeof signature !== "string" ? TERSE_SIGNATURE_HEADER : null,
            typeof timestampStr !== "string" ? TERSE_TIMESTAMP_HEADER : null
        ].filter(Boolean)
        throw new Error(
            `Missing required headers: ${missing.join(", ")}.\n` +
            `Make sure requests to this endpoint are coming from Terse (not a browser or other client) ` +
            `and that your reverse proxy is forwarding all headers.`
        )
    }
    const timestamp = Number(timestampStr)
    if (Number.isNaN(timestamp)) {
        throw new Error(
            `"${TERSE_TIMESTAMP_HEADER}" header is not a valid number (got "${timestampStr}").`
        )
    }
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp)
    if (age > MAX_TIMESTAMP_AGE_SECONDS) {
        throw new Error(
            `Request timestamp is ${age}s old (max allowed: ${MAX_TIMESTAMP_AGE_SECONDS}s). ` +
            `Check that your server's clock is in sync.`
        )
    }
    if (!verifyRequestSignature(signingSecret, signature, timestamp, rawBody)) {
        throw new Error(
            `Request signature does not match. ` +
            `Verify that TERSE_SIGNING_SECRET matches the value shown in the Terse dashboard.`
        )
    }
}
