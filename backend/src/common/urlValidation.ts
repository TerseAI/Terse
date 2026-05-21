import ipaddr from "ipaddr.js"
import dns from "node:dns/promises"
import net from "node:net"
import { URL } from "node:url"

import { settings } from "../config/settings"

function isBlockedIP(ip: string): boolean {
    let parsed: ipaddr.IPv4 | ipaddr.IPv6
    try {
        parsed = ipaddr.parse(ip)
    } catch {
        return true
    }

    if (parsed.kind() === "ipv6") {
        const v6 = parsed as ipaddr.IPv6
        if (v6.isIPv4MappedAddress()) return isBlockedIP(v6.toIPv4Address().toString())
    }

    return parsed.range() !== "unicast"
}

export class UrlValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "UrlValidationError"
    }
}

export type ValidatedRemoteUrl = {
    url: string
    parsedUrl: URL
    hostname: string
    pinnedAddress: string | null
}

export async function validateRemoteServerUrl(url: string): Promise<ValidatedRemoteUrl> {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new UrlValidationError("Invalid URL format")
    }

    const explicitDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
    const isDev = explicitDev && settings.nodeEnv === "development"
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1"

    if (parsed.protocol === "http:") {
        if (isDev && isLocalhost) return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress: null }
        throw new UrlValidationError("Remote server URL must use HTTPS")
    }

    if (parsed.protocol !== "https:") {
        throw new UrlValidationError("Remote server URL must use HTTPS")
    }

    if (isDev && isLocalhost) return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress: null }

    if (net.isIP(parsed.hostname)) {
        if (isBlockedIP(parsed.hostname)) {
            throw new UrlValidationError("Remote server URL must not point to a private or reserved IP address")
        }
        return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress: parsed.hostname }
    }

    const results4 = await dns.resolve4(parsed.hostname).catch(() => [] as string[])
    const results6 = await dns.resolve6(parsed.hostname).catch(() => [] as string[])
    const addresses = [...results4, ...results6]

    if (addresses.length === 0) {
        throw new UrlValidationError(`Could not resolve hostname: ${parsed.hostname}`)
    }

    for (const addr of addresses) {
        if (isBlockedIP(addr)) {
            throw new UrlValidationError("Remote server URL must not resolve to a private or reserved IP address")
        }
    }

    const pinnedAddress = results4[0] ?? results6[0]
    return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress }
}
