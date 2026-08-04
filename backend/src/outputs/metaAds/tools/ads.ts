import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsAdSchema } from "terse-types"
import type { MetaAdsReadAdsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient, toActPath } from "./metaAdsClient"

export const metaAdsReadAdsTool = defineSessionTool({
    name: "meta_ads_read_ads",
    execute: metaAdsToolExecute("meta_ads_read_ads", executeReadAdsRequest)
})

// Asking for creative{...} inlines the creative on each ad, which is what makes
// ad-level insights attributable to a specific piece of creative.
const AD_FIELDS = ["id", "name", "status", "effective_status", "campaign_id", "adset_id", "created_time", "creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}"]

async function executeReadAdsRequest(request: MetaAdsReadAdsRequest, client: MetaAdsClient): Promise<MetaAdsReadAdsOutput> {
    const params = {
        limit: request.limit ?? 100,
        ...(request.effectiveStatuses?.length ? { effective_status: request.effectiveStatuses } : {})
    }
    const parent = resolveParent(request, client)
    const ads = await client.collect(() => parent.getAds(AD_FIELDS, params), metaAdsAdSchema, "ads")
    return {
        success: true,
        ads,
        count: ads.length,
        actions: [
            {
                action: "Listed ads",
                integration: IntegrationType.META_ADS,
                target: request.adsetId ?? request.campaignId ?? toActPath(request.adAccountId),
                details: `Found ${ads.length} ad(s)`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

function resolveParent(request: MetaAdsReadAdsRequest, client: MetaAdsClient) {
    if (request.adsetId) {
        return client.adSet(request.adsetId)
    }
    if (request.campaignId) {
        return client.campaign(request.campaignId)
    }
    return client.adAccount(request.adAccountId)
}

type MetaAdsReadAdsOutput = ToolOutputByName["meta_ads_read_ads"]
