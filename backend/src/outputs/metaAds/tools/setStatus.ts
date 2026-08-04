import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { MetaAdsSetStatusRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient } from "./metaAdsClient"

export const metaAdsSetStatusTool = defineSessionTool({
    name: "meta_ads_set_status",
    execute: metaAdsToolExecute("meta_ads_set_status", executeSetStatusRequest)
})

async function executeSetStatusRequest(request: MetaAdsSetStatusRequest, client: MetaAdsClient): Promise<MetaAdsSetStatusOutput> {
    const entity = resolveEntity(request, client)
    await client.mutate(() => entity.update([], { status: request.status }), `${request.entityType} status`)

    const verb = request.status === "PAUSED" ? "Paused" : "Resumed"
    return {
        success: true,
        entityType: request.entityType,
        entityId: request.entityId,
        status: request.status,
        actions: [
            {
                action: `${verb} ${request.entityType}`,
                integration: IntegrationType.META_ADS,
                target: request.entityId,
                details: `Set ${request.entityType} ${request.entityId} to ${request.status}`,
                type: RunHistoryActionType.update
            }
        ]
    }
}

function resolveEntity(request: MetaAdsSetStatusRequest, client: MetaAdsClient) {
    switch (request.entityType) {
        case "campaign":
            return client.campaign(request.entityId)
        case "adset":
            return client.adSet(request.entityId)
        case "ad":
            return client.ad(request.entityId)
        default:
            throw request.entityType satisfies never
    }
}

type MetaAdsSetStatusOutput = ToolOutputByName["meta_ads_set_status"]
