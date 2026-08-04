import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsInsightsRowSchema } from "terse-types"
import type { MetaAdsReadInsightsRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient, toActPath } from "./metaAdsClient"

export const metaAdsReadInsightsTool = defineSessionTool({
    name: "meta_ads_read_insights",
    execute: metaAdsToolExecute("meta_ads_read_insights", executeReadInsightsRequest)
})

const INSIGHT_METRIC_FIELDS = ["spend", "impressions", "clicks", "ctr", "cpc", "reach", "actions"]
const MAX_INSIGHT_ROWS = 2000

async function executeReadInsightsRequest(request: MetaAdsReadInsightsRequest, client: MetaAdsClient): Promise<MetaAdsReadInsightsOutput> {
    const fields = [...entityFieldsForLevel(request.level), ...INSIGHT_METRIC_FIELDS]
    const params = {
        level: request.level,
        ...(request.datePreset ? { date_preset: request.datePreset } : {}),
        ...(request.since && request.until ? { time_range: { since: request.since, until: request.until } } : {}),
        ...(request.timeIncrement ? { time_increment: request.timeIncrement } : {}),
        ...(request.breakdowns?.length ? { breakdowns: request.breakdowns } : {}),
        ...buildFiltering(request),
        limit: 500
    }

    const { items: rows, truncated } = await client.collectPaged(() => client.adAccount(request.adAccountId).getInsights(fields, params), metaAdsInsightsRowSchema, "insights", MAX_INSIGHT_ROWS)
    return {
        success: true,
        rows,
        count: rows.length,
        truncated,
        actions: [
            {
                action: "Read ad insights",
                integration: IntegrationType.META_ADS,
                target: toActPath(request.adAccountId),
                details: `Fetched ${rows.length} ${request.level}-level insight row(s)${truncated ? " (truncated)" : ""}`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

function entityFieldsForLevel(level: MetaAdsReadInsightsRequest["level"]): string[] {
    switch (level) {
        case "campaign":
            return ["campaign_id", "campaign_name"]
        case "adset":
            return ["campaign_id", "campaign_name", "adset_id", "adset_name"]
        case "ad":
            return ["campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name"]
        default:
            throw level satisfies never
    }
}

function buildFiltering(request: MetaAdsReadInsightsRequest): Record<string, unknown> {
    const filters: Array<{ field: string; operator: "IN"; value: string[] }> = []
    if (request.campaignIds?.length) {
        filters.push({ field: "campaign.id", operator: "IN", value: request.campaignIds })
    }
    if (request.adsetIds?.length) {
        filters.push({ field: "adset.id", operator: "IN", value: request.adsetIds })
    }
    if (request.adIds?.length) {
        filters.push({ field: "ad.id", operator: "IN", value: request.adIds })
    }
    return filters.length ? { filtering: filters } : {}
}

type MetaAdsReadInsightsOutput = ToolOutputByName["meta_ads_read_insights"]
