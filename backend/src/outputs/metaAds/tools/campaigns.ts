import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsAdSetSchema, metaAdsCampaignSchema } from "terse-types"
import type { MetaAdsListAdSetsRequest, MetaAdsListCampaignsRequest, MetaAdsReadCampaignsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { buildMetaQuery, fetchMetaAdsAdAccounts, metaGraphList, toActPath } from "./metaAdsGraph"

export const metaAdsReadCampaignsTool = defineSessionTool({
    name: "meta_ads_read_campaigns",
    execute: metaAdsToolExecute("meta_ads_read_campaigns", executeReadCampaignsRequest)
})

async function executeReadCampaignsRequest(request: MetaAdsReadCampaignsRequest, accessToken: string): Promise<MetaAdsReadCampaignsOutput> {
    switch (request.action) {
        case "list_ad_accounts":
            return listAdAccounts(accessToken)
        case "list_campaigns":
            return listCampaigns(request, accessToken)
        case "list_adsets":
            return listAdSets(request, accessToken)
        default:
            throw request satisfies never
    }
}

async function listAdAccounts(accessToken: string): Promise<MetaAdsReadCampaignsOutput> {
    const adAccounts = await fetchMetaAdsAdAccounts(accessToken)
    return {
        success: true,
        adAccounts,
        count: adAccounts.length,
        actions: [readAction("Listed ad accounts", "Meta Ads", `Found ${adAccounts.length} ad account(s)`)]
    }
}

const CAMPAIGN_FIELDS = "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time"

async function listCampaigns(request: MetaAdsListCampaignsRequest, accessToken: string): Promise<MetaAdsReadCampaignsOutput> {
    const query = buildMetaQuery({
        fields: CAMPAIGN_FIELDS,
        limit: request.limit ?? 100,
        effective_status: request.effectiveStatuses?.length ? JSON.stringify(request.effectiveStatuses) : undefined
    })
    const campaigns = await metaGraphList(accessToken, `/${toActPath(request.adAccountId)}/campaigns${query}`, metaAdsCampaignSchema, "campaigns")
    return {
        success: true,
        campaigns,
        count: campaigns.length,
        actions: [readAction("Listed campaigns", toActPath(request.adAccountId), `Found ${campaigns.length} campaign(s)`)]
    }
}

const ADSET_FIELDS = "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,start_time,end_time"

async function listAdSets(request: MetaAdsListAdSetsRequest, accessToken: string): Promise<MetaAdsReadCampaignsOutput> {
    const query = buildMetaQuery({
        fields: ADSET_FIELDS,
        limit: request.limit ?? 100,
        effective_status: request.effectiveStatuses?.length ? JSON.stringify(request.effectiveStatuses) : undefined
    })
    const basePath = request.campaignId ? `/${encodeURIComponent(request.campaignId)}` : `/${toActPath(request.adAccountId)}`
    const adsets = await metaGraphList(accessToken, `${basePath}/adsets${query}`, metaAdsAdSetSchema, "ad sets")
    return {
        success: true,
        adsets,
        count: adsets.length,
        actions: [readAction("Listed ad sets", request.campaignId ?? toActPath(request.adAccountId), `Found ${adsets.length} ad set(s)`)]
    }
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
