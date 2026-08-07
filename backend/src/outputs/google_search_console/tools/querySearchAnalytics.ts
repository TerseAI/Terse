import { searchconsole_v1 } from "@googleapis/searchconsole"
import { RunHistoryActionType } from "@prisma/client"
import { ToolInputByName, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { requireSearchConsoleSiteContext, searchConsoleAction } from "./toolContext"

type QueryInput = ToolInputByName["google_search_console_query_search_analytics"]
type QueryRow = ToolOutputByName["google_search_console_query_search_analytics"]["rows"][number]
type Dimension = NonNullable<QueryInput["dimensions"]>[number]

export const googleSearchConsoleQuerySearchAnalyticsTool = defineSessionTool({
    name: "google_search_console_query_search_analytics",
    execute: async (input, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(input.integrationId, input.siteUrl, runContext)
        const dimensions = input.dimensions ?? []

        const response = await client.searchanalytics.query({
            siteUrl: property,
            requestBody: buildRequestBody(input, dimensions)
        })

        const rows = (response.data.rows ?? []).map(row => toQueryRow(row, dimensions))

        return {
            success: true,
            rows,
            responseAggregationType: response.data.responseAggregationType ?? null,
            firstIncompleteDate: response.data.metadata?.firstIncompleteDate ?? null,
            actions: [
                searchConsoleAction({
                    action: "Queried Search Console analytics",
                    siteUrl: property,
                    details: `${input.startDate} to ${input.endDate}${dimensions.length > 0 ? ` grouped by ${dimensions.join(", ")}` : ""}: ${rows.length} ${rows.length === 1 ? "row" : "rows"}`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                })
            ]
        }
    }
})

/** Unset optional fields are omitted so Google's own defaults apply. */
function buildRequestBody(input: QueryInput, dimensions: readonly Dimension[]): searchconsole_v1.Schema$SearchAnalyticsQueryRequest {
    return {
        startDate: input.startDate,
        endDate: input.endDate,
        ...(dimensions.length > 0 ? { dimensions: [...dimensions] } : {}),
        ...(input.dimensionFilterGroups?.length ? { dimensionFilterGroups: toFilterGroups(input.dimensionFilterGroups) } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.aggregationType ? { aggregationType: input.aggregationType } : {}),
        ...(input.rowLimit ? { rowLimit: input.rowLimit } : {}),
        ...(input.startRow != null ? { startRow: input.startRow } : {}),
        ...(input.dataState ? { dataState: input.dataState } : {})
    }
}

function toFilterGroups(groups: NonNullable<QueryInput["dimensionFilterGroups"]>): searchconsole_v1.Schema$ApiDimensionFilterGroup[] {
    return groups.map(group => ({
        ...(group.groupType ? { groupType: group.groupType } : {}),
        filters: group.filters.map(filter => ({
            dimension: filter.dimension,
            expression: filter.expression,
            ...(filter.operator ? { operator: filter.operator } : {})
        }))
    }))
}

/** Google returns each row's dimension values positionally, in the order they were requested. */
function toQueryRow(row: searchconsole_v1.Schema$ApiDataRow, dimensions: readonly Dimension[]): QueryRow {
    const keys = row.keys ?? []
    const named = dimensions.reduce<Partial<Record<Dimension, string>>>((acc, dimension, index) => {
        const value = keys[index]
        if (value !== undefined) acc[dimension] = value
        return acc
    }, {})

    return {
        dimensions: named,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0
    }
}
