import type { Request } from "express"
import type { IncomingMessage } from "http"

export function extractClientIp(req: IncomingMessage | Request): string | undefined {
    const headers = req.headers
    const trueClient = firstHeaderValue(headers["true-client-ip"])
    if (trueClient) return trueClient
    const xff = firstHeaderValue(headers["x-forwarded-for"])
    if (xff) {
        const first = xff.split(",")[0]?.trim()
        if (first) return first
    }
    return req.socket?.remoteAddress
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0]?.trim() || undefined
    if (typeof value === "string" && value.length > 0) return value.trim()
    return undefined
}
