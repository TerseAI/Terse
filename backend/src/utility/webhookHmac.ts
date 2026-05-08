import crypto from "crypto"
import { TERSE_SIGNATURE_HEADER, TERSE_SIGNATURE_VERSION, TERSE_TIMESTAMP_HEADER } from "terse-types/types"

/** Generate a random challenge token for the handshake. */
export function generateChallengeToken(): string {
    return crypto.randomBytes(32).toString("hex")
}

/** Compute an HMAC-SHA256 signature for an outbound request body. */
function computeRequestSignature(signingSecret: string, timestamp: number, body: string): string {
    const baseString = `${TERSE_SIGNATURE_VERSION}:${timestamp}:${body}`
    const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex")
    return `${TERSE_SIGNATURE_VERSION}=${hmac}`
}

/** Build signature headers to include on outbound requests. */
export function buildSignatureHeaders(signingSecret: string, body: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = computeRequestSignature(signingSecret, timestamp, body)
    return {
        [TERSE_SIGNATURE_HEADER]: signature,
        [TERSE_TIMESTAMP_HEADER]: String(timestamp)
    }
}

/** Verify an incoming request signature using timing-safe comparison. */
function verifyRequestSignature(signingSecret: string, signature: string, timestamp: number, body: string): boolean {
    const expected = computeRequestSignature(signingSecret, timestamp, body)
    if (signature.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/** Compute an HMAC-SHA256 of a challenge token (used in challenge-response identity proof). */
function computeChallengeSignature(signingSecret: string, challengeToken: string): string {
    return crypto.createHmac("sha256", signingSecret).update(challengeToken).digest("hex")
}

/** Verify a challenge response signature using timing-safe comparison. */
export function verifyChallengeSignature(signingSecret: string, challengeToken: string, signature: string): boolean {
    const expected = computeChallengeSignature(signingSecret, challengeToken)
    if (signature.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
