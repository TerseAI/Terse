import dns from "node:dns/promises"
import net from "node:net"
import { URL } from "node:url"

import { settings } from "../config/settings"

const BLOCKED_IPV4_RANGES = [{ prefix: "127." }, { prefix: "10." }, { prefix: "0." }, { prefix: "169.254." }, { prefix: "224." }]

function isBlockedIPv4(ip: string): boolean {
    if (BLOCKED_IPV4_RANGES.some(r => ip.startsWith(r.prefix))) return true

    // 172.16.0.0/12
    if (ip.startsWith("172.")) {
        const second = parseInt(ip.split(".")[1], 10)
        if (second >= 16 && second <= 31) return true
    }

    // 192.168.0.0/16
    if (ip.startsWith("192.168.")) return true

    return false
}

function isBlockedIP(ip: string): boolean {
    if (net.isIPv4(ip)) return isBlockedIPv4(ip)

    if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    if (ip.startsWith("::ffff:")) {
        const v4 = ip.slice(7)
        if (net.isIPv4(v4)) return isBlockedIPv4(v4)
    }

    return false
}

export class UrlValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "UrlValidationError"
    }
}

/**
 * The result of validating a remote server URL. Carries the pinned IP that
 * passed validation so the subsequent fetch can connect to that exact address
 * (eliminating the TOCTOU window between c-ares and getaddrinfo that DNS
 * rebinding exploits). When `pinnedAddress` is null the caller should fall
 * back to the system resolver — currently only happens for dev-localhost.
 */
export type ValidatedRemoteUrl = {
    url: string
    parsedUrl: URL
    hostname: string
    pinnedAddress: string | null
}

/**
 * Validates a remote server URL for safety before storing or fetching.
 *
 * In production: requires HTTPS and blocks private/reserved IPs.
 * In development: allows HTTP to localhost/127.0.0.1 for local testing.
 *
 * Returns the IP that should be used for the outbound connect. Callers MUST
 * pass that IP through safeFetch (see utility/safeFetch.ts) — otherwise the
 * fetch will issue its own DNS lookup and the validation guarantee is lost.
 */
export async function validateRemoteServerUrl(url: string): Promise<ValidatedRemoteUrl> {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new UrlValidationError("Invalid URL format")
    }

    const isDev = settings.nodeEnv === "development"
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1"

    // In dev, allow http for localhost only
    if (parsed.protocol === "http:") {
        if (isDev && isLocalhost) return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress: null }
        throw new UrlValidationError("Remote server URL must use HTTPS")
    }

    if (parsed.protocol !== "https:") {
        throw new UrlValidationError("Remote server URL must use HTTPS")
    }

    // Skip IP checks for localhost in dev
    if (isDev && isLocalhost) return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress: null }

    // If the hostname is a raw IP, check it directly
    if (net.isIP(parsed.hostname)) {
        if (isBlockedIP(parsed.hostname)) {
            throw new UrlValidationError("Remote server URL must not point to a private or reserved IP address")
        }
        return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress: parsed.hostname }
    }

    // Resolve the hostname and check all returned addresses
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

    // Pin to the first IPv4 if present, else the first IPv6. Every returned
    // address passed validation, so picking any one is safe.
    const pinnedAddress = results4[0] ?? results6[0]
    return { url, parsedUrl: parsed, hostname: parsed.hostname, pinnedAddress }
}
