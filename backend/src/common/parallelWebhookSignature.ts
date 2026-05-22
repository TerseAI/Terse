import crypto from "node:crypto"

export function verifyParallelWebhookSignature(webhookSignatureHeader: string | undefined, secret: string, webhookId: string, webhookTimestamp: string, rawBody: string | Buffer): boolean {
    if (!webhookSignatureHeader) return false
    const expectedDigest = crypto.createHmac("sha256", secret).update(`${webhookId}.${webhookTimestamp}.${rawBody.toString()}`).digest()

    for (const part of webhookSignatureHeader.trim().split(/\s+/)) {
        const comma = part.indexOf(",")
        if (comma === -1) continue
        const sigB64 = part.slice(comma + 1)
        let sigBuf: Buffer
        try {
            sigBuf = Buffer.from(sigB64, "base64")
        } catch {
            continue
        }
        if (sigBuf.length !== expectedDigest.length) continue
        if (crypto.timingSafeEqual(sigBuf, expectedDigest)) return true
    }
    return false
}
