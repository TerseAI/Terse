import { metaAdsCustomAudienceSchema } from "terse-types"

import { toActPath } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsListWindow, metaAdsReadAction, requireMetaAdsClient } from "./toolContext"

const CUSTOM_AUDIENCE_FIELDS = ["id", "name", "subtype", "approximate_count_lower_bound", "approximate_count_upper_bound", "delivery_status"]

export const metaAdsListAudiencesTool = defineSessionTool({
    name: "meta_ads_list_audiences",
    execute: async ({ integrationId, adAccountId, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const { items: audiences, truncated } = await client.collectPaged(
            () => client.adAccount(adAccountId).getCustomAudiences(CUSTOM_AUDIENCE_FIELDS, { limit: pageSize }),
            metaAdsCustomAudienceSchema,
            "custom audiences",
            maxItems
        )

        return {
            success: true,
            audiences,
            count: audiences.length,
            truncated,
            actions: [metaAdsReadAction("Listed custom audiences", toActPath(adAccountId), `Found ${audiences.length} custom audience(s)${truncated ? " (truncated)" : ""}`)]
        }
    }
})
