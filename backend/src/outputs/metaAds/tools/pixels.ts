import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsPixelSchema } from "terse-types"
import type { MetaAdsListPixelsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { buildMetaQuery, metaGraphList, toActPath } from "./metaAdsGraph"

export const metaAdsListPixelsTool = defineSessionTool({
    name: "meta_ads_list_pixels",
    execute: metaAdsToolExecute("meta_ads_list_pixels", executeListPixelsRequest)
})

async function executeListPixelsRequest(request: MetaAdsListPixelsRequest, accessToken: string): Promise<MetaAdsListPixelsOutput> {
    const query = buildMetaQuery({
        fields: "id,name,last_fired_time",
        limit: request.limit ?? 100
    })
    const pixels = await metaGraphList(accessToken, `/${toActPath(request.adAccountId)}/adspixels${query}`, metaAdsPixelSchema, "pixels")
    return {
        success: true,
        pixels,
        count: pixels.length,
        actions: [
            {
                action: "Listed pixels",
                integration: IntegrationType.META_ADS,
                target: toActPath(request.adAccountId),
                details: `Found ${pixels.length} pixel(s)`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

type MetaAdsListPixelsOutput = ToolOutputByName["meta_ads_list_pixels"]
