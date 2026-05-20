import dns from "node:dns/promises"
import net from "node:net"
import { URL } from "node:url"

import ipaddr from "ipaddr.js"

import { settings } from "../config/settings"

// RFC 6890 (IPv4) + RFC 5156 (IPv6) special-purpose ranges that must never be
// the target of an outbound fetch from a user-controlled URL.
const BLOCKED_IPV4_CIDRS: Array<[string, number]> = [
    ["0.0.0.0", 8], // RFC 1122 — "this network"
    ["10.0.0.0", 8], // RFC 1918 private
    ["100.64.0.0", 10], // RFC 6598 CGNAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local incl. cloud metadata 169.254.169.254
    ["172.16.0.0", 12], // RFC 1918 private
    ["192.0.0.0", 24], // IETF protocol assignments
    ["192.0.2.0", 24], // TEST-NET-1
    ["192.168.0.0", 16], // RFC 1918 private
    ["198.18.0.0", 15], // network benchmark
    ["198.51.100.0", 24], // TEST-NET-2
    ["203.0.113.0", 24], // TEST-NET-3
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved / class E (covers 255.255.255.255 broadcast)
]

const BLOCKED_IPV6_CIDRS: Array<[string, number]> = [
    ["::", 128], // unspecified
    ["::1", 128], // loopback
    ["64:ff9b::", 96], // NAT64
    ["100::", 64], // discard prefix
    ["2001:db8::", 32], // documentation
    ["2002::", 16], // 6to4 (can re-enter IPv4 space)
    ["fc00::", 7], // unique local
    ["fe80::", 10], // link local
    ["ff00::", 8], // multicast
]

function isBlockedIP(ip: string): boolean {
    let parsed: ipaddr.IPv4 | ipaddr.IPv6
    try {
        parsed = ipaddr.parse(ip)
    } catch {
        // Not a parseable IP — let the higher-level URL validator reject it.
        return true
    }

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — collapse to IPv4 first.
    if (parsed.kind() === "ipv6") {
        const v6 = parsed as ipaddr.IPv6
        if (v6.isIPv4MappedAddress()) {
            return isBlockedIP(v6.toIPv4Address().toString())
        }
        return BLOCKED_IPV6_CIDRS.some(([cidr, bits]) => v6.match(ipaddr.IPv6.parse(cidr), bits))
    }

    const v4 = parsed as ipaddr.IPv4
    return BLOCKED_IPV4_CIDRS.some(([cidr, bits]) => v4.match(ipaddr.IPv4.parse(cidr), bits))
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

    // Fail closed: anything that isn't an *explicit* development/test env is
    // treated as production. Without this, a missing NODE_ENV (common in
    // containerised/serverless deploys) would default to "development" and
    // open up the localhost-HTTP escape hatch on a real prod host.
    const explicitDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
    const isDev = explicitDev && settings.nodeEnv === "development"
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
