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
        throw new Error("Missing Terse signature headers")
    }
    const timestamp = Number(timestampStr)
    if (Number.isNaN(timestamp)) {
        throw new Error("Invalid Terse timestamp header")
    }
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp)
    if (age > MAX_TIMESTAMP_AGE_SECONDS) {
        throw new Error("Terse request timestamp is too old")
    }
    if (!verifyRequestSignature(signingSecret, signature, timestamp, rawBody)) {
        throw new Error("Invalid Terse request signature")
    }
}
