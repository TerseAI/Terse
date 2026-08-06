import { metaAdsCampaignSchema } from "terse-types"

import { toActPath } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsListWindow, metaAdsReadAction, requireMetaAdsClient, withEffectiveStatuses } from "./toolContext"

const CAMPAIGN_FIELDS = ["id", "name", "status", "effective_status", "objective", "daily_budget", "lifetime_budget", "start_time", "stop_time"]

export const metaAdsListCampaignsTool = defineSessionTool({
    name: "meta_ads_list_campaigns",
    execute: async ({ integrationId, adAccountId, effectiveStatuses, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const params = withEffectiveStatuses({ limit: pageSize }, effectiveStatuses)
        const { items: campaigns, truncated } = await client.collectPaged(() => client.adAccount(adAccountId).getCampaigns(CAMPAIGN_FIELDS, params), metaAdsCampaignSchema, "campaigns", maxItems)

        return {
            success: true,
            campaigns,
            count: campaigns.length,
            truncated,
            actions: [metaAdsReadAction("Listed campaigns", toActPath(adAccountId), `Found ${campaigns.length} campaign(s)${truncated ? " (truncated)" : ""}`)]
        }
    }
})
