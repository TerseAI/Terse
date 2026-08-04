import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsAdAccountEntitySchema, metaAdsAdSetSchema, metaAdsCampaignSchema } from "terse-types"
import type { MetaAdsListAdSetsRequest, MetaAdsListCampaignsRequest, MetaAdsReadCampaignsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { META_ADS_AD_ACCOUNT_FIELDS, MetaAdsClient, toActPath } from "./metaAdsClient"

export const metaAdsReadCampaignsTool = defineSessionTool({
    name: "meta_ads_read_campaigns",
    execute: metaAdsToolExecute("meta_ads_read_campaigns", executeReadCampaignsRequest)
})

async function executeReadCampaignsRequest(request: MetaAdsReadCampaignsRequest, client: MetaAdsClient): Promise<MetaAdsReadCampaignsOutput> {
    switch (request.action) {
        case "list_ad_accounts":
            return listAdAccounts(client)
        case "list_campaigns":
            return listCampaigns(request, client)
        case "list_adsets":
            return listAdSets(request, client)
        default:
            throw request satisfies never
    }
}

async function listAdAccounts(client: MetaAdsClient): Promise<MetaAdsReadCampaignsOutput> {
    const adAccounts = await client.collect(() => client.me().getAdAccounts(META_ADS_AD_ACCOUNT_FIELDS, { limit: 200 }), metaAdsAdAccountEntitySchema, "ad accounts")
    return {
        success: true,
        adAccounts,
        count: adAccounts.length,
        actions: [readAction("Listed ad accounts", "Meta Ads", `Found ${adAccounts.length} ad account(s)`)]
    }
}

const CAMPAIGN_FIELDS = ["id", "name", "status", "effective_status", "objective", "daily_budget", "lifetime_budget", "start_time", "stop_time"]

async function listCampaigns(request: MetaAdsListCampaignsRequest, client: MetaAdsClient): Promise<MetaAdsReadCampaignsOutput> {
    const params = withEffectiveStatuses({ limit: request.limit ?? 100 }, request.effectiveStatuses)
    const campaigns = await client.collect(() => client.adAccount(request.adAccountId).getCampaigns(CAMPAIGN_FIELDS, params), metaAdsCampaignSchema, "campaigns")
    return {
        success: true,
        campaigns,
        count: campaigns.length,
        actions: [readAction("Listed campaigns", toActPath(request.adAccountId), `Found ${campaigns.length} campaign(s)`)]
    }
}

const ADSET_FIELDS = ["id", "name", "status", "effective_status", "campaign_id", "daily_budget", "lifetime_budget", "optimization_goal", "start_time", "end_time"]

async function listAdSets(request: MetaAdsListAdSetsRequest, client: MetaAdsClient): Promise<MetaAdsReadCampaignsOutput> {
    const params = withEffectiveStatuses({ limit: request.limit ?? 100 }, request.effectiveStatuses)
    const parent = request.campaignId ? client.campaign(request.campaignId) : client.adAccount(request.adAccountId)
    const adsets = await client.collect(() => parent.getAdSets(ADSET_FIELDS, params), metaAdsAdSetSchema, "ad sets")
    return {
        success: true,
        adsets,
        count: adsets.length,
        actions: [readAction("Listed ad sets", request.campaignId ?? toActPath(request.adAccountId), `Found ${adsets.length} ad set(s)`)]
    }
}

function withEffectiveStatuses(params: Record<string, unknown>, effectiveStatuses?: string[] | null): Record<string, unknown> {
    if (!effectiveStatuses?.length) {
        return params
    }
    return { ...params, effective_status: effectiveStatuses }
}

function readAction(action: string, target: string, details: string) {
    return {
        action,
        integration: IntegrationType.META_ADS,
        target,
        details,
        type: RunHistoryActionType.read
    }
}

type MetaAdsReadCampaignsOutput = ToolOutputByName["meta_ads_read_campaigns"]
