import { metaAdsPixelSchema } from "terse-types"

import { toActPath } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsListWindow, metaAdsReadAction, requireMetaAdsClient } from "./toolContext"

const PIXEL_FIELDS = ["id", "name", "last_fired_time"]

export const metaAdsListPixelsTool = defineSessionTool({
    name: "meta_ads_list_pixels",
    execute: async ({ integrationId, adAccountId, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const { items: pixels, truncated } = await client.collectPaged(() => client.adAccount(adAccountId).getAdsPixels(PIXEL_FIELDS, { limit: pageSize }), metaAdsPixelSchema, "pixels", maxItems)

        return {
            success: true,
            pixels,
            count: pixels.length,
            truncated,
            actions: [metaAdsReadAction("Listed pixels", toActPath(adAccountId), `Found ${pixels.length} pixel(s)${truncated ? " (truncated)" : ""}`)]
        }
    }
})
