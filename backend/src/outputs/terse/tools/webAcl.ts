import { WebConfig } from "terse-types"

import { ToolACLValidationResult, ToolACLValidator, denyToolACL } from "../../abstract/acl"

// Parses a URL or bare domain to its lowercase hostname (sans a leading "www."), via the WHATWG URL parser. Null when unparseable.
function toHostname(value: string): string | null {
    const trimmed = value.trim()
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    try {
        return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "")
    } catch {
        return null
    }
}

// True when `value`'s host equals an allowed domain or is a subdomain of one.
function isAllowed(value: string, allowedDomains: readonly string[]): boolean {
    const host = toHostname(value)
    return !!host && allowedDomains.some(domain => {
        const allowed = toHostname(domain)
        return !!allowed && (host === allowed || host.endsWith(`.${allowed}`))
    })
}

// The union of allowed domains across the Web configs. Empty means no whitelist is active (unrestricted).
function collectAllowedDomains(configs: WebConfig[]): string[] {
    return Array.from(new Set(configs.flatMap(c => c.allowedDomains ?? [])))
}

function denyOffenders(values: readonly string[], allowedDomains: readonly string[], label: string): ToolACLValidationResult {
    const offenders = values.filter(value => !isAllowed(value, allowedDomains))
    if (offenders.length === 0) return { ok: true }
    return denyToolACL(`${label} not in allowed domains (${offenders.join(", ")}). Allowed: ${allowedDomains.join(", ")}.`)
}

export const validateWebExtract: ToolACLValidator<"web_extract", WebConfig> = ({ args, configs }) => {
    const allowedDomains = collectAllowedDomains(configs)
    if (allowedDomains.length === 0) return { ok: true }
    const urls = Array.isArray(args.urls) ? args.urls : [args.urls]
    return denyOffenders(urls, allowedDomains, "web_extract URLs")
}

export const validateWebSearch: ToolACLValidator<"web_search", WebConfig> = ({ args, configs }) => {
    const allowedDomains = collectAllowedDomains(configs)
    if (allowedDomains.length === 0) return { ok: true }
    const includeDomains = args.include_domains ?? []
    if (includeDomains.length === 0) {
        return denyToolACL(`web_search must set include_domains to a subset of the allowed domains: ${allowedDomains.join(", ")}.`)
    }
    return denyOffenders(includeDomains, allowedDomains, "web_search include_domains")
}
