import { metaAdsInsightsRowSchema } from "terse-types"
import type { ToolInputByName } from "terse-types"

import { toActPath } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsReadAction, requireMetaAdsClient } from "./toolContext"

const INSIGHT_METRIC_FIELDS = ["spend", "impressions", "clicks", "ctr", "cpc", "reach", "actions"]
const MAX_INSIGHT_ROWS = 2000
const INSIGHT_PAGE_SIZE = 500

export const metaAdsReadInsightsTool = defineSessionTool({
    name: "meta_ads_read_insights",
    execute: async (input, runContext) => {
        const client = await requireMetaAdsClient(input.integrationId, runContext)
        const fields = [...entityFieldsForLevel(input.level), ...INSIGHT_METRIC_FIELDS]
        const params = {
            level: input.level,
            ...(input.datePreset ? { date_preset: input.datePreset } : {}),
            ...(input.since && input.until ? { time_range: { since: input.since, until: input.until } } : {}),
            ...(input.timeIncrement ? { time_increment: input.timeIncrement } : {}),
            ...(input.breakdowns?.length ? { breakdowns: input.breakdowns } : {}),
            ...buildFiltering(input),
            limit: INSIGHT_PAGE_SIZE
        }

        const { items: rows, truncated } = await client.collectPaged(() => client.adAccount(input.adAccountId).getInsights(fields, params), metaAdsInsightsRowSchema, "insights", MAX_INSIGHT_ROWS)
        return {
            success: true,
            rows,
            count: rows.length,
            truncated,
            actions: [metaAdsReadAction("Read ad insights", toActPath(input.adAccountId), `Fetched ${rows.length} ${input.level}-level insight row(s)${truncated ? " (truncated)" : ""}`)]
        }
    }
})

function entityFieldsForLevel(level: MetaAdsReadInsightsInput["level"]): string[] {
    switch (level) {
        case "account":
            return []
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

function buildFiltering(input: MetaAdsReadInsightsInput): Record<string, unknown> {
    const filters: Array<{ field: string; operator: "IN"; value: string[] }> = []
    if (input.campaignIds?.length) {
        filters.push({ field: "campaign.id", operator: "IN", value: input.campaignIds })
    }
    if (input.adsetIds?.length) {
        filters.push({ field: "adset.id", operator: "IN", value: input.adsetIds })
    }
    if (input.adIds?.length) {
        filters.push({ field: "ad.id", operator: "IN", value: input.adIds })
    }
    return filters.length ? { filtering: filters } : {}
}

type MetaAdsReadInsightsInput = ToolInputByName["meta_ads_read_insights"]
