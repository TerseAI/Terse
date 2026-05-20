import type { Request } from "express"
import type { IncomingMessage } from "http"

export function extractClientIp(req: IncomingMessage | Request): string | undefined {
    const value = req.headers["true-client-ip"]
    if (Array.isArray(value)) return value[0]?.trim() || undefined
    if (typeof value === "string" && value.length > 0) return value.trim()
    return undefined
}
