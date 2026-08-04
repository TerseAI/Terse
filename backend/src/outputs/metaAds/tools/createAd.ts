import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { MetaAdsCreateAdRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient, toActPath } from "./metaAdsClient"

export const metaAdsCreateAdTool = defineSessionTool({
    name: "meta_ads_create_ad",
    execute: metaAdsToolExecute("meta_ads_create_ad", executeCreateAdRequest)
})

// Creative content is immutable in Meta, and an ad's creative cannot be swapped,
// so every creative revision is a fresh creative plus a fresh ad.
async function executeCreateAdRequest(request: MetaAdsCreateAdRequest, client: MetaAdsClient): Promise<MetaAdsCreateAdOutput> {
    const adAccount = client.adAccount(request.adAccountId)
    const requestedStatus = request.status ?? "PAUSED"

    const creativeId = await client.createdId(() => adAccount.createAdCreative([], buildCreativeParams(request)), "ad creative")

    const adId = await client.createdId(
        () =>
            adAccount.createAd([], {
                name: request.name,
                adset_id: request.adsetId,
                creative: { creative_id: creativeId },
                status: requestedStatus
            }),
        "ad"
    )

    return {
        success: true,
        adId,
        creativeId,
        adsetId: request.adsetId,
        requestedStatus,
        actions: [
            {
                action: "Created ad",
                integration: IntegrationType.META_ADS,
                target: toActPath(request.adAccountId),
                details: `Created ad "${request.name}" (${adId}) in ad set ${request.adsetId} with status ${requestedStatus}; Meta reviews new ads before delivery`,
                type: RunHistoryActionType.create
            }
        ]
    }
}

function buildCreativeParams(request: MetaAdsCreateAdRequest): Record<string, unknown> {
    return {
        name: `${request.name} creative`,
        object_story_spec: {
            page_id: request.pageId,
            link_data: {
                link: request.linkUrl,
                message: request.message,
                // Meta downloads this once and copies it into the ad account's
                // image library, so a short-lived signed URL is enough.
                picture: request.pictureUrl,
                ...(request.headline ? { name: request.headline } : {}),
                ...(request.description ? { description: request.description } : {}),
                call_to_action: { type: request.callToAction ?? "LEARN_MORE", value: { link: request.linkUrl } }
            }
        },
        degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } }
    }
}

type MetaAdsCreateAdOutput = ToolOutputByName["meta_ads_create_ad"]
