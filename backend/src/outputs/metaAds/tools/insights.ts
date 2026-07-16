import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsInsightsRowSchema } from "terse-types"
import type { MetaAdsReadInsightsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { buildMetaQuery, metaGraphList, toActPath } from "./metaAdsGraph"

export const metaAdsReadInsightsTool = defineSessionTool({
    name: "meta_ads_read_insights",
    execute: metaAdsToolExecute("meta_ads_read_insights", executeReadInsightsRequest)
})

const INSIGHT_METRIC_FIELDS = ["spend", "impressions", "clicks", "ctr", "cpc", "reach", "actions"]

async function executeReadInsightsRequest(request: MetaAdsReadInsightsRequest, accessToken: string): Promise<MetaAdsReadInsightsOutput> {
    const entityFields = request.level === "campaign" ? ["campaign_id", "campaign_name"] : ["campaign_id", "campaign_name", "adset_id", "adset_name"]
    const query = buildMetaQuery({
        level: request.level,
        fields: [...entityFields, ...INSIGHT_METRIC_FIELDS].join(","),
        date_preset: request.datePreset ?? undefined,
        time_range: request.since && request.until ? JSON.stringify({ since: request.since, until: request.until }) : undefined,
        time_increment: request.timeIncrement ?? undefined,
        filtering: buildFiltering(request),
        limit: 500
    })

    const rows = await metaGraphList(accessToken, `/${toActPath(request.adAccountId)}/insights${query}`, metaAdsInsightsRowSchema, "insights")
    return {
        success: true,
        rows,
        count: rows.length,
        actions: [
            {
                action: "Read ad insights",
                integration: IntegrationType.META_ADS,
                target: toActPath(request.adAccountId),
                details: `Fetched ${rows.length} ${request.level}-level insight row(s)`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

function buildFiltering(request: MetaAdsReadInsightsRequest): string | undefined {
    const filters: Array<{ field: string; operator: "IN"; value: string[] }> = []
    if (request.campaignIds?.length) {
        filters.push({ field: "campaign.id", operator: "IN", value: request.campaignIds })
    }
    if (request.adsetIds?.length) {
        filters.push({ field: "adset.id", operator: "IN", value: request.adsetIds })
    }
    return filters.length ? JSON.stringify(filters) : undefined
}

type MetaAdsReadInsightsOutput = ToolOutputByName["meta_ads_read_insights"]
