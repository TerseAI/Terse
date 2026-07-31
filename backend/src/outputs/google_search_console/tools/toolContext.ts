import { RunContext } from "@openai/agents-core"
import { GoogleSearchConsoleConfigData, IntegrationType, RunHistoryAction } from "terse-types"

import { Session } from "../../../express"
import { SearchConsoleClient, getSearchConsoleClientForOrganization } from "../../../integrations/googlesearchconsole/apiClient"
import { isSiteUrlAllowed, isUrlUnderProperty, normalizeSiteUrl } from "../../../integrations/googlesearchconsole/siteScope"
import { SessionWithTracking } from "../../../modules/agents/AgentRunner/BaseAgentRunner"
import { ToolACLValidationResult, denyToolACL, findConfigsByIntegrationId } from "../../abstract/acl"

export async function requireSearchConsoleClient(integrationId: string, runContext: RunContext<SessionWithTracking<Session>> | undefined): Promise<SearchConsoleClient> {
    if (!runContext?.context) {
        throw new Error("No context provided")
    }
    return getSearchConsoleClientForOrganization(integrationId, runContext.context.user.organizationId)
}

/**
 * The ACL forgives casing and a missing trailing slash, but Google matches property
 * identifiers exactly, so normalize before the call rather than only before the check.
 */
export async function requireSearchConsoleSiteContext(
    integrationId: string,
    siteUrl: string,
    runContext: RunContext<SessionWithTracking<Session>> | undefined
): Promise<{ client: SearchConsoleClient; siteUrl: string }> {
    const client = await requireSearchConsoleClient(integrationId, runContext)
    return { client, siteUrl: normalizeSiteUrl(siteUrl) }
}

export function searchConsoleAction(args: { action: string; siteUrl: string; details: string; type: RunHistoryAction["type"]; isReadOnly: boolean }): RunHistoryAction {
    return {
        action: args.action,
        integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
        target: args.siteUrl,
        details: args.details,
        type: args.type,
        isReadOnly: args.isReadOnly
    }
}

export function requireSiteUrlInScope(integrationId: string, siteUrl: string, configs: GoogleSearchConsoleConfigData[]): ToolACLValidationResult {
    const allowed = allowedSiteUrlsFor(integrationId, configs)
    if (isSiteUrlAllowed(siteUrl, allowed)) {
        return { ok: true }
    }
    return denyToolACL(
        `Search Console property "${siteUrl}" is not in the allowed list for integration "${integrationId}". Allowed properties: ${allowed.join(", ") || "(none)"}. A Domain property (sc-domain:example.com) also covers its subdomains.`
    )
}

export function requireUrlUnderSiteUrl(integrationId: string, siteUrl: string, inspectionUrl: string, configs: GoogleSearchConsoleConfigData[]): ToolACLValidationResult {
    const siteCheck = requireSiteUrlInScope(integrationId, siteUrl, configs)
    if (!siteCheck.ok) return siteCheck

    if (isUrlUnderProperty(inspectionUrl, siteUrl)) {
        return { ok: true }
    }
    return denyToolACL(`URL "${inspectionUrl}" is not under the Search Console property "${siteUrl}".`)
}

export function allowedSiteUrlsFor(integrationId: string, configs: GoogleSearchConsoleConfigData[]): string[] {
    return Array.from(new Set(findConfigsByIntegrationId(integrationId, configs).flatMap(config => config.siteUrls ?? [])))
}
