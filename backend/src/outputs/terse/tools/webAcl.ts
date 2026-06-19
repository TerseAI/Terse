import { WebConfig } from "terse-types"

import { ToolACLValidator, denyToolACL, isHostAllowed, requireHostsInAllowedDomains } from "../../abstract/acl"

// The union of allowed domains across the Web configs. Empty means no whitelist is active (unrestricted).
function collectAllowedDomains(configs: WebConfig[]): string[] {
    return Array.from(new Set(configs.flatMap(c => c.allowedDomains ?? [])))
}

export const validateWebExtract: ToolACLValidator<"web_extract", WebConfig> = ({ args, configs }) => {
    const allowedDomains = collectAllowedDomains(configs)
    if (allowedDomains.length === 0) {
        return { ok: true }
    }
    const urls = Array.isArray(args.urls) ? args.urls : [args.urls]
    return requireHostsInAllowedDomains(urls, allowedDomains, "web_extract URLs")
}

export const validateWebSearch: ToolACLValidator<"web_search", WebConfig> = ({ args, configs }) => {
    const allowedDomains = collectAllowedDomains(configs)
    if (allowedDomains.length === 0) {
        return { ok: true }
    }
    const includeDomains = args.include_domains
    if (!includeDomains || includeDomains.length === 0) {
        return denyToolACL(`web_search must set include_domains to a subset of the allowed domains: ${allowedDomains.join(", ")}.`)
    }
    const offenders = includeDomains.filter(domain => !isHostAllowed(domain, allowedDomains))
    if (offenders.length > 0) {
        return denyToolACL(`web_search include_domains not in allowed list (${offenders.join(", ")}). Allowed: ${allowedDomains.join(", ")}.`)
    }
    return { ok: true }
}
