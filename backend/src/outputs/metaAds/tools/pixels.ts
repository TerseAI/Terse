import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsPixelSchema } from "terse-types"
import type { MetaAdsListPixelsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient, toActPath } from "./metaAdsClient"

export const metaAdsListPixelsTool = defineSessionTool({
    name: "meta_ads_list_pixels",
    execute: metaAdsToolExecute("meta_ads_list_pixels", executeListPixelsRequest)
})

const PIXEL_FIELDS = ["id", "name", "last_fired_time"]

async function executeListPixelsRequest(request: MetaAdsListPixelsRequest, client: MetaAdsClient): Promise<MetaAdsListPixelsOutput> {
    const pixels = await client.collect(() => client.adAccount(request.adAccountId).getAdsPixels(PIXEL_FIELDS, { limit: request.limit ?? 100 }), metaAdsPixelSchema, "pixels")
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
