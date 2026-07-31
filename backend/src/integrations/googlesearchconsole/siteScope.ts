const DOMAIN_PROPERTY_PREFIX = "sc-domain:"

/**
 * Search Console treats property identifiers as exact strings, so a request that
 * differs only by casing or a missing trailing slash would be denied by our ACL
 * before Google ever sees it. Normalize both sides of every comparison.
 */
export function normalizeSiteUrl(siteUrl: string): string {
    const trimmed = siteUrl.trim()
    if (isDomainProperty(trimmed)) {
        return `${DOMAIN_PROPERTY_PREFIX}${normalizeHost(trimmed.slice(DOMAIN_PROPERTY_PREFIX.length))}`
    }
    const parsed = parseUrl(trimmed)
    if (!parsed) return trimmed
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = normalizeHost(parsed.hostname)
    return parsed.pathname === "/" && !parsed.search && !parsed.hash ? parsed.origin + "/" : parsed.toString()
}

export function isSiteUrlAllowed(requestedSiteUrl: string, allowedSiteUrls: readonly string[]): boolean {
    const requested = normalizeSiteUrl(requestedSiteUrl)
    return allowedSiteUrls.some(allowed => grantsAccess(normalizeSiteUrl(allowed), requested))
}

/**
 * A domain property covers the host and every subdomain of it, in either property
 * form. A URL-prefix property covers only itself.
 */
function grantsAccess(allowed: string, requested: string): boolean {
    if (allowed === requested) return true
    if (!isDomainProperty(allowed)) return false

    const allowedHost = allowed.slice(DOMAIN_PROPERTY_PREFIX.length)
    const requestedHost = hostOfProperty(requested)
    return requestedHost !== null && isHostAtOrUnder(requestedHost, allowedHost)
}

export function isUrlUnderProperty(url: string, siteUrl: string): boolean {
    const parsed = parseUrl(url.trim())
    if (!parsed) return false

    const property = normalizeSiteUrl(siteUrl)
    if (isDomainProperty(property)) {
        return isHostAtOrUnder(normalizeHost(parsed.hostname), property.slice(DOMAIN_PROPERTY_PREFIX.length))
    }
    return normalizeSiteUrl(parsed.toString()).startsWith(property)
}

export function isDomainProperty(siteUrl: string): boolean {
    return siteUrl.toLowerCase().startsWith(DOMAIN_PROPERTY_PREFIX)
}

function hostOfProperty(property: string): string | null {
    if (isDomainProperty(property)) return property.slice(DOMAIN_PROPERTY_PREFIX.length)
    const parsed = parseUrl(property)
    return parsed ? normalizeHost(parsed.hostname) : null
}

function isHostAtOrUnder(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`)
}

function normalizeHost(host: string): string {
    return host.trim().toLowerCase().replace(/\.$/, "")
}

function parseUrl(value: string): URL | null {
    try {
        return new URL(value)
    } catch {
        return null
    }
}
