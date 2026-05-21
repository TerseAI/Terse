import crypto from "crypto"
import { TERSE_SIGNATURE_HEADER, TERSE_SIGNATURE_VERSION, TERSE_TIMESTAMP_HEADER } from "terse-types/types"

export function generateChallengeToken(): string {
    return crypto.randomBytes(32).toString("hex")
}

function computeRequestSignature(signingSecret: string, timestamp: number, body: string): string {
    const baseString = `${TERSE_SIGNATURE_VERSION}:${timestamp}:${body}`
    const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex")
    return `${TERSE_SIGNATURE_VERSION}=${hmac}`
}

export function buildSignatureHeaders(signingSecret: string, body: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = computeRequestSignature(signingSecret, timestamp, body)
    return { [TERSE_SIGNATURE_HEADER]: signature, [TERSE_TIMESTAMP_HEADER]: String(timestamp) }
}

function computeChallengeSignature(signingSecret: string, challengeToken: string): string {
    return crypto.createHmac("sha256", signingSecret).update(challengeToken).digest("hex")
}

export function verifyChallengeSignature(signingSecret: string, challengeToken: string, signature: string): boolean {
    const expected = computeChallengeSignature(signingSecret, challengeToken)
    if (signature.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
