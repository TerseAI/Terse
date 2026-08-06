import { RunContext } from "@openai/agents-core"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, MetaAdsOutputConfigData, RunHistoryAction } from "terse-types"

import { Session } from "../../../express"
import { MetaAdsAuthError, MetaAdsClient, toActPath } from "../../../integrations/metaAds/apiClient"
import { MetaAdsIntegrationManager } from "../../../integrations/metaAds/integration"
import { db } from "../../../loaders/prisma"
import { SessionWithTracking } from "../../../modules/agents/AgentRunner/BaseAgentRunner"
import { ToolACLValidationResult, denyToolACL, findConfigsByIntegrationId } from "../../abstract/acl"

const META_ADS_DEFAULT_LIMIT = 100

/**
 * `limit` is the number of items the caller wants, not a page size, so it doubles
 * as the pagination cap. Meta clamps per-edge page sizes well below 500, which is
 * why a single page used to silently drop the rest.
 */
export function metaAdsListWindow(limit: number | null | undefined): { pageSize: number; maxItems: number } {
    const maxItems = limit ?? META_ADS_DEFAULT_LIMIT
    return { pageSize: maxItems, maxItems }
}

export async function requireMetaAdsClient(integrationId: string, runContext: RunContext<SessionWithTracking<Session>> | undefined): Promise<MetaAdsClient> {
    if (!runContext?.context) {
        throw new Error("No context provided")
    }
    return getMetaAdsClientForOrganization(integrationId, runContext.context.user.organizationId)
}

export function metaAdsAction(args: { action: string; target: string; details: string; type: RunHistoryAction["type"]; isReadOnly: boolean }): RunHistoryAction {
    return {
        action: args.action,
        integration: IntegrationType.META_ADS,
        target: args.target,
        details: args.details,
        type: args.type,
        isReadOnly: args.isReadOnly
    }
}

export function metaAdsReadAction(action: string, target: string, details: string): RunHistoryAction {
    return metaAdsAction({ action, target, details, type: RunHistoryActionType.read, isReadOnly: true })
}

export function withEffectiveStatuses(params: Record<string, unknown>, effectiveStatuses?: string[] | null): Record<string, unknown> {
    if (!effectiveStatuses?.length) {
        return params
    }
    return { ...params, effective_status: effectiveStatuses }
}

/**
 * Ad account edges narrow through `filtering`, not through bare campaign_id / adset_id
 * params, which Meta ignores silently rather than rejecting.
 */
export function withIdFilters(params: Record<string, unknown>, filters: Array<{ field: string; id: string | null | undefined }>): Record<string, unknown> {
    const filtering = filters.filter((filter): filter is { field: string; id: string } => !!filter.id).map(filter => ({ field: filter.field, operator: "IN" as const, value: [filter.id] }))
    return filtering.length ? { ...params, filtering } : params
}

export function requireAdAccountInScope(integrationId: string, adAccountId: string, configs: MetaAdsOutputConfigData[]): ToolACLValidationResult {
    return requireMetaAdsIdInScope(
        adAccountId,
        allowedIdsFor(integrationId, configs, config => config.adAccountId),
        "Ad account",
        integrationId,
        toActPath
    )
}

export function requirePageInScope(integrationId: string, pageId: string, configs: MetaAdsOutputConfigData[]): ToolACLValidationResult {
    return requireMetaAdsIdInScope(
        pageId,
        allowedIdsFor(integrationId, configs, config => config.pageId),
        "Page",
        integrationId,
        id => id
    )
}

/**
 * An automation that names no ad account is unscoped by choice, so an empty allow
 * list permits everything the connection's token can reach.
 */
function requireMetaAdsIdInScope(requested: string, allowed: string[], noun: string, integrationId: string, normalize: (id: string) => string): ToolACLValidationResult {
    if (allowed.length === 0) {
        return { ok: true }
    }
    if (allowed.some(candidate => normalize(candidate) === normalize(requested))) {
        return { ok: true }
    }
    return denyToolACL(`${noun} "${requested}" is not in the allowed list for integration "${integrationId}". Allowed: ${allowed.join(", ")}.`)
}

function allowedIdsFor(integrationId: string, configs: MetaAdsOutputConfigData[], pick: (config: MetaAdsOutputConfigData) => string | null): string[] {
    return Array.from(
        new Set(
            findConfigsByIntegrationId(integrationId, configs)
                .map(pick)
                .filter((value): value is string => !!value)
        )
    )
}

async function getMetaAdsClientForOrganization(integrationId: string, organizationId: string): Promise<MetaAdsClient> {
    const integration = await db().meta_ads_integrations.findUnique({
        where: { id: integrationId, organization_id: organizationId },
        select: { id: true }
    })
    if (!integration) {
        throw new MetaAdsAuthError(`Meta Ads integration not found or not authorized for this organization: ${integrationId}`)
    }

    const accessToken = await new MetaAdsIntegrationManager().getAccessToken(integrationId)
    if (!accessToken) {
        throw new MetaAdsAuthError(`Meta Ads integration ${integrationId} is not connected or is missing its access token.`)
    }

    return new MetaAdsClient(accessToken)
}
