import { RunHistoryActionType } from "@prisma/client"
import type { ToolInputByName } from "terse-types"

import { MetaAdsClient } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsAction, requireMetaAdsClient } from "./toolContext"

export const metaAdsSetStatusTool = defineSessionTool({
    name: "meta_ads_set_status",
    execute: async ({ integrationId, entityType, entityId, status }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const entity = resolveEntity(client, entityType, entityId)
        await client.mutate(() => entity.update([], { status }), `${entityType} status`)

        const verb = status === "PAUSED" ? "Paused" : "Resumed"
        return {
            success: true,
            entityType,
            entityId,
            status,
            actions: [
                metaAdsAction({
                    action: `${verb} ${entityType}`,
                    target: entityId,
                    details: `Set ${entityType} ${entityId} to ${status}`,
                    type: RunHistoryActionType.update,
                    isReadOnly: false
                })
            ]
        }
    }
})

function resolveEntity(client: MetaAdsClient, entityType: MetaAdsSetStatusInput["entityType"], entityId: string) {
    switch (entityType) {
        case "campaign":
            return client.campaign(entityId)
        case "adset":
            return client.adSet(entityId)
        case "ad":
            return client.ad(entityId)
        default:
            throw entityType satisfies never
    }
}

type MetaAdsSetStatusInput = ToolInputByName["meta_ads_set_status"]
