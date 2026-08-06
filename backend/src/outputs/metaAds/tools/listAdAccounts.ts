import { metaAdsAdAccountEntitySchema } from "terse-types"

import { META_ADS_AD_ACCOUNT_FIELDS } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsListWindow, metaAdsReadAction, requireMetaAdsClient } from "./toolContext"

export const metaAdsListAdAccountsTool = defineSessionTool({
    name: "meta_ads_list_ad_accounts",
    execute: async ({ integrationId, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const { items: adAccounts, truncated } = await client.collectPaged(
            () => client.me().getAdAccounts(META_ADS_AD_ACCOUNT_FIELDS, { limit: pageSize }),
            metaAdsAdAccountEntitySchema,
            "ad accounts",
            maxItems
        )

        return {
            success: true,
            adAccounts,
            count: adAccounts.length,
            truncated,
            actions: [metaAdsReadAction("Listed ad accounts", "Meta Ads", `Found ${adAccounts.length} ad account(s)`)]
        }
    }
})
