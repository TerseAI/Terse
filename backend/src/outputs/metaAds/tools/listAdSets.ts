import { metaAdsAdSetSchema } from "terse-types"

import { toActPath } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsListWindow, metaAdsReadAction, requireMetaAdsClient, withEffectiveStatuses, withIdFilters } from "./toolContext"

const ADSET_FIELDS = ["id", "name", "status", "effective_status", "campaign_id", "daily_budget", "lifetime_budget", "optimization_goal", "start_time", "end_time"]

export const metaAdsListAdSetsTool = defineSessionTool({
    name: "meta_ads_list_adsets",
    execute: async ({ integrationId, adAccountId, campaignId, effectiveStatuses, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const params = withIdFilters(withEffectiveStatuses({ limit: pageSize }, effectiveStatuses), [{ field: "campaign.id", id: campaignId }])
        const { items: adsets, truncated } = await client.collectPaged(() => client.adAccount(adAccountId).getAdSets(ADSET_FIELDS, params), metaAdsAdSetSchema, "ad sets", maxItems)

        const scope = campaignId ? `campaign ${campaignId}` : toActPath(adAccountId)
        return {
            success: true,
            adsets,
            count: adsets.length,
            truncated,
            actions: [metaAdsReadAction("Listed ad sets", toActPath(adAccountId), `Found ${adsets.length} ad set(s) in ${scope}${truncated ? " (truncated)" : ""}`)]
        }
    }
})
