import { TERSE_SIGNATURE_HEADER, TERSE_SIGNATURE_VERSION, TERSE_TIMESTAMP_HEADER } from "terse-types"

const MAX_TIMESTAMP_AGE_SECONDS = 300

async function computeRequestSignature(signingSecret: string, timestamp: number, body: string): Promise<string> {
    const baseString = `${TERSE_SIGNATURE_VERSION}:${timestamp}:${body}`
    return `${TERSE_SIGNATURE_VERSION}=${await hmacSha256Hex(signingSecret, baseString)}`
}

async function verifyRequestSignature(signingSecret: string, signature: string, timestamp: number, body: string): Promise<boolean> {
    const expected = await computeRequestSignature(signingSecret, timestamp, body)
    return timingSafeEqualHex(signature, expected)
}

/** Compute the HMAC-SHA256 of a challenge token using the signing secret. */
export async function computeChallengeSignature(signingSecret: string, challengeToken: string): Promise<string> {
    return hmacSha256Hex(signingSecret, challengeToken)
}

/**
 * Verify an incoming Terse request signature. Throws if invalid or missing.
 * Useful both internally and as a public export for custom middleware.
 */
export async function verifyIncomingRequest(signingSecret: string, headers: Record<string, string | string[] | undefined>, rawBody: string): Promise<void> {
    const signature = headers[TERSE_SIGNATURE_HEADER]
    const timestampStr = headers[TERSE_TIMESTAMP_HEADER]
    if (typeof signature !== "string" || typeof timestampStr !== "string") {
        const missing = [typeof signature !== "string" ? TERSE_SIGNATURE_HEADER : null, typeof timestampStr !== "string" ? TERSE_TIMESTAMP_HEADER : null].filter(Boolean)
        throw new Error(
            `Missing required headers: ${missing.join(", ")}.\n` +
                `Make sure requests to this endpoint are coming from Terse (not a browser or other client) ` +
                `and that your reverse proxy is forwarding all headers.`
        )
    }
    const timestamp = Number(timestampStr)
    if (Number.isNaN(timestamp)) {
        throw new Error(`"${TERSE_TIMESTAMP_HEADER}" header is not a valid number (got "${timestampStr}").`)
    }
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp)
    if (age > MAX_TIMESTAMP_AGE_SECONDS) {
        throw new Error(`Request timestamp is ${age}s old (max allowed: ${MAX_TIMESTAMP_AGE_SECONDS}s). ` + `Check that your server's clock is in sync.`)
    }
    if (!(await verifyRequestSignature(signingSecret, signature, timestamp, rawBody))) {
        throw new Error(`Request signature does not match. ` + `Verify that TERSE_SIGNING_SECRET matches the value shown in the Terse dashboard.`)
    }
}

// HMAC-SHA256 (hex) via Web Crypto (globalThis.crypto.subtle) instead of
// node:crypto, so this module stays Node-free and is importable from a workflow
// body. SubtleCrypto is async-only, hence the Promise.
async function hmacSha256Hex(signingSecret: string, message: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message))
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("")
}

// Constant-time comparison of two hex signatures (replaces crypto.timingSafeEqual).
function timingSafeEqualHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let mismatch = 0
    for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return mismatch === 0
}
