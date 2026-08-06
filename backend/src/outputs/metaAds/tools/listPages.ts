import { metaAdsPageSchema } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsListWindow, metaAdsReadAction, requireMetaAdsClient } from "./toolContext"

const PAGE_FIELDS = ["id", "name", "category"]

export const metaAdsListPagesTool = defineSessionTool({
    name: "meta_ads_list_pages",
    execute: async ({ integrationId, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const { items: pages, truncated } = await client.collectPaged(() => client.me().getAccounts(PAGE_FIELDS, { limit: pageSize }), metaAdsPageSchema, "pages", maxItems)

        return {
            success: true,
            pages,
            count: pages.length,
            truncated,
            actions: [metaAdsReadAction("Listed Facebook Pages", "Meta Ads", `Found ${pages.length} Page(s)${truncated ? " (truncated)" : ""}`)]
        }
    }
})
