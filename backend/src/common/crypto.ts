import crypto from "crypto"

export function secretsMatch(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8")
    const bBuf = Buffer.from(b, "utf8")
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
}
