import { Client } from "@notionhq/client"
import { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints"
import { IntegrationType, NotionConfig } from "terse-types"

import logger from "../../../common/logger"
import { getNotionAccessTokenForOrganization } from "../../../integrations/NotionIntegration"
import { verifyNotionDatabaseInScope } from "../../../integrations/notion/acl"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

// Helper function to extract readable values from Notion property objects
function extractPropertyValue(property: any): any {
    switch (property.type) {
        case "title":
            return property.title.map((t: any) => t.plain_text).join("")
        case "rich_text":
            return property.rich_text.map((t: any) => t.plain_text).join("")
        case "number":
            return property.number
        case "select":
            return property.select?.name || null
        case "multi_select":
            return property.multi_select.map((s: any) => s.name)
        case "date":
            return property.date
        case "checkbox":
            return property.checkbox
        case "url":
            return property.url
        case "email":
            return property.email
        case "phone_number":
            return property.phone_number
        case "status":
            return property.status?.name || null
        case "people":
            return property.people.map((p: any) => p.name || p.id)
        case "files":
            return property.files.map((f: any) => f.name)
        case "relation":
            return property.relation.map((r: any) => r.id)
        default:
            return null
    }
}

type QueryDatabasePageResult = {
    page_id: string
    properties: Record<string, any>
    url: any
    created_time: any
    last_edited_time: any
}

export const notionQueryDatabaseTool = defineSessionTool({
    name: "notion_query_database",
    description: `Query a Notion data source (database) to retrieve pages that match specific criteria.

WHEN TO USE THIS TOOL:
- Verify if the database contains any existing records and avoid creating duplicates.
- When you need to find specific pages matching certain criteria (e.g., status, date ranges, property values)
- When you need to retrieve a subset of pages rather than all pages in the database
- When working with large databases and need pagination to retrieve results in batches
- When you only need specific properties from pages (use filter_properties for efficiency)

WHAT THIS TOOL DOES:
1. Filters pages at the Notion API level (not client-side) for maximum efficiency
2. Supports complex filtering with AND/OR logic, property filters, and timestamp filters
3. Supports pagination - use start_cursor from previous responses to get next page
4. Supports filter_properties to only fetch needed fields, reducing response size and improving speed

FILTERING:
- Property filters: Filter by any database property (title, number, date, select, status, checkbox, etc.)
- Timestamp filters: Filter by created_time or last_edited_time (these are SYSTEM FIELDS, not database properties)
- Compound filters: Combine filters with AND/OR logic
- All filtering happens server-side at Notion for efficiency

SYSTEM FIELDS (available on ALL pages, not shown in schema):
- created_time: When the page was created. Use timestamp filter format (NO "property" field).
- last_edited_time: When the page was last edited. Use timestamp filter format (NO "property" field).
- created_by: User who created the page. Use people filter WITH "property" field.
- last_edited_by: User who last edited the page. Use people filter WITH "property" field.

IMPORTANT: Timestamp filters (created_time, last_edited_time) use a DIFFERENT format than property filters:
- CORRECT: {"timestamp": "created_time", "created_time": {"on_or_after": "2024-01-01"}}
- WRONG: {"property": "created_time", "date": {"on_or_after": "2024-01-01"}}

PAGINATION:
- Use page_size to control how many results per page (default: all results)
- Use start_cursor from the response to fetch the next page
- The response includes has_more and next_cursor when more pages are available

FILTER_PROPERTIES:
- Specify only the properties you need to reduce response size and improve performance
- Especially important for databases with many properties or complex formulas/rollups
- You can fetch additional properties later using Retrieve page property item API

NOTE: This tool does NOT return the database schema. Use notion_get_schema if you need schema information.`,
    execute: async ({ integrationId, databaseId, filter_properties, filter, page_size, start_cursor, result_type }, runContext) => {
        logger.debug("Executing notion_query_database tool with filters", { integrationId, databaseId, filter_properties, filter, page_size, start_cursor })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getNotionAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const notion = new Client({
            auth: accessToken
        })

        // Build query parameters
        const queryParams: any = {
            data_source_id: databaseId
        }

        if (filter_properties && filter_properties.length > 0) {
            queryParams.filter_properties = filter_properties
        }

        if (filter) {
            // Parse the JSON string
            let parsedFilter: Record<string, any>
            try {
                parsedFilter = JSON.parse(filter)
            } catch (error) {
                return {
                    success: false,
                    pages: [],
                    total_returned: 0,
                    has_more: false,
                    next_cursor: null,
                    error: "Invalid JSON in filter parameter",
                    hint: "Ensure filter is a valid JSON string"
                }
            }
            // Filter is validated by Notion API at runtime, so we can safely pass it through
            queryParams.filter = parsedFilter
        }

        if (page_size) {
            queryParams.page_size = page_size
        }

        if (start_cursor) {
            queryParams.start_cursor = start_cursor
        }

        if (result_type) {
            queryParams.result_type = result_type
        }

        // Fetch pages using data source query with filters
        const response = await notion.dataSources.query(queryParams)

        // Retrieve data source info to get the database URL
        const dataSourceInfo: GetDataSourceResponse = await notion.dataSources.retrieve({
            data_source_id: databaseId
        })
        const databaseUrl = "url" in dataSourceInfo ? dataSourceInfo.url : undefined
        const databaseName = "title" in dataSourceInfo ? dataSourceInfo.title?.[0]?.plain_text || "Unknown Database" : "Unknown Database"

        // Convert to readable format
        const pages = response.results
            .map((page: any): QueryDatabasePageResult | null => {
                if (!page.properties) return null

                // Extract all properties as simple key-value pairs
                const properties: Record<string, any> = {}
                for (const [key, value] of Object.entries(page.properties)) {
                    properties[key] = extractPropertyValue(value)
                }

                return {
                    page_id: page.id,
                    properties: properties,
                    url: page.url,
                    created_time: page.created_time,
                    last_edited_time: page.last_edited_time
                }
            })
            .filter((page): page is QueryDatabasePageResult => page !== null)

        // Return action as part of the result
        const filterDescription = filter ? "with filters" : "without filters"
        const action = {
            action: "Queried database",
            integration: IntegrationType.NOTION,
            target: databaseName,
            details: `Queried database ${filterDescription} and retrieved ${pages.length} ${pages.length === 1 ? "page" : "pages"}`,
            url: databaseUrl as string | undefined,
            type: "read" as const
        }

        logger.debug("Notion query database tool response", {
            pages_count: pages.length,
            has_more: response.has_more,
            next_cursor: response.next_cursor
        })

        return {
            success: true,
            pages: pages,
            total_returned: pages.length,
            actions: [action],
            has_more: response.has_more || false,
            next_cursor: response.next_cursor || null
        }
    }
})

export const validateNotionQueryDatabase: ToolACLValidator<"notion_query_database", NotionConfig> = async ({ args, configs, runContext }) => {
    return verifyNotionDatabaseInScope(args.integrationId, runContext.context.user.organizationId, args.databaseId, configs)
}
