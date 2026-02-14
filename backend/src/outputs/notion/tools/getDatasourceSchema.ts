import { Client } from "@notionhq/client"
import { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints"
import { RunContext, tool } from "@openai/agents"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { NotionIntegrationManager } from "../../../integrations/NotionIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

// Helper function to build property schema with format examples
function buildPropertySchema(propertyName: string, propertyConfig: any): any {
    const baseSchema: any = {
        type: propertyConfig.type,
        id: propertyConfig.id
    }

    // Add format examples and options for each type
    switch (propertyConfig.type) {
        case "title":
            baseSchema.format_example = `{"${propertyName}": {"title": [{"text": {"content": "Your text here"}}]}}`
            break
        case "rich_text":
            baseSchema.format_example = `{"${propertyName}": {"rich_text": [{"text": {"content": "Your text here"}}]}}`
            break
        case "number":
            baseSchema.format_example = `{"${propertyName}": {"number": 123}}`
            break
        case "select":
            baseSchema.options = propertyConfig.select?.options?.map((opt: any) => opt.name) || []
            baseSchema.format_example = `{"${propertyName}": {"select": {"name": "OptionName"}}}`
            break
        case "multi_select":
            baseSchema.options = propertyConfig.multi_select?.options?.map((opt: any) => opt.name) || []
            baseSchema.format_example = `{"${propertyName}": {"multi_select": [{"name": "Option1"}, {"name": "Option2"}]}}`
            break
        case "status":
            baseSchema.options = propertyConfig.status?.options?.map((opt: any) => opt.name) || []
            baseSchema.format_example = `{"${propertyName}": {"status": {"name": "StatusOption"}}}`
            break
        case "date":
            baseSchema.format_example = `{"${propertyName}": {"date": {"start": "2025-01-15"}}}`
            break
        case "checkbox":
            baseSchema.format_example = `{"${propertyName}": {"checkbox": true}}`
            break
        case "url":
            baseSchema.format_example = `{"${propertyName}": {"url": "https://example.com"}}`
            break
        case "email":
            baseSchema.format_example = `{"${propertyName}": {"email": "user@example.com"}}`
            break
        case "phone_number":
            baseSchema.format_example = `{"${propertyName}": {"phone_number": "+1234567890"}}`
            break
    }

    return baseSchema
}

export const notionGetSchemaTool = tool({
    name: ToolName.NOTION_GET_SCHEMA,
    description: `Gets the schema/structure of the Notion data source. This tool retrieves all property definitions including property names, types, valid options for select/status fields, and exact format examples for how to construct each property when writing to the database.

Use this tool:
- Before writing any data to determine available properties and their correct formats
- To understand what property names exist and their data types
- To get valid option values for select, multi_select, and status properties
- To see exact format examples for constructing properties in the Notion API format
- To determine how to write to the Notion database by understanding its structure
- To see available system fields (created_time, last_edited_time, created_by, last_edited_by) and how to filter by them

The schema information returned by this tool should be used to properly format properties when calling notion_create_or_update_database_row to create or update rows in the database.

SYSTEM FIELDS: The response includes system_fields which describe built-in Notion page fields like created_time and last_edited_time. These can be used for filtering (using special timestamp filter format without 'property' field) but cannot be edited.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        databaseId: z.string().describe("The Notion database ID (data source ID) to get the schema for.")
    }),
    execute: async ({ integrationId, databaseId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing notion_get_schema tool")
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new NotionIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Notion integration not found or access denied for integrationId: ${integrationId}`)
        }

        const notion = new Client({
            auth: accessToken
        })

        // Fetch data source schema using the Notion API
        // The database_id in the config is actually the data_source_id
        const dataSourceInfo: GetDataSourceResponse = await notion.dataSources.retrieve({
            data_source_id: databaseId
        })

        // Extract schema information with format examples
        const schema: Record<string, any> = {}
        for (const [propertyName, propertyConfig] of Object.entries(dataSourceInfo.properties as Record<string, any>)) {
            schema[propertyName] = buildPropertySchema(propertyName, propertyConfig)
        }

        // Add system fields that exist on all Notion pages (not part of dataSourceInfo.properties)
        // These can be used for filtering but not for writing
        const systemFields = {
            created_time: {
                type: "system",
                description: "When the page was created (read-only, filterable)",
                filter_format: `For filtering, use timestamp filter: {"timestamp": "created_time", "created_time": {"on_or_after": "2024-01-01"}}`,
                filter_conditions: ["after", "before", "equals", "on_or_after", "on_or_before", "is_empty", "is_not_empty", "past_week", "past_month", "past_year", "next_week", "next_month", "next_year", "this_week"],
                note: "Do NOT include 'property' field when filtering by timestamp - use the special timestamp filter format instead"
            },
            last_edited_time: {
                type: "system",
                description: "When the page was last edited (read-only, filterable)",
                filter_format: `For filtering, use timestamp filter: {"timestamp": "last_edited_time", "last_edited_time": {"on_or_after": "2024-01-01"}}`,
                filter_conditions: ["after", "before", "equals", "on_or_after", "on_or_before", "is_empty", "is_not_empty", "past_week", "past_month", "past_year", "next_week", "next_month", "next_year", "this_week"],
                note: "Do NOT include 'property' field when filtering by timestamp - use the special timestamp filter format instead"
            },
            created_by: {
                type: "system",
                description: "User who created the page (read-only, filterable using people filter with 'property' field)",
                filter_format: `{"property": "created_by", "people": {"contains": "user-id"}}`
            },
            last_edited_by: {
                type: "system",
                description: "User who last edited the page (read-only, filterable using people filter with 'property' field)",
                filter_format: `{"property": "last_edited_by", "people": {"contains": "user-id"}}`
            }
        }

        // Push run action to track the API call
        const databaseName = "title" in dataSourceInfo ? dataSourceInfo.title?.[0]?.plain_text || "Unknown Database" : "Unknown Database"
        const dataSourceUrl = "url" in dataSourceInfo ? dataSourceInfo.url : undefined
        const action = {
            action: "Retrieved schema",
            integration: IntegrationType.NOTION,
            target: databaseName,
            details: `Retrieved schema with ${Object.keys(schema).length} properties`,
            url: dataSourceUrl,
            type: "read"
        }

        return {
            actions: [action],
            data_source_id: databaseId,
            database_name: databaseName,
            schema: schema,
            property_count: Object.keys(schema).length,
            system_fields: systemFields,
            system_fields_note: "System fields (created_time, last_edited_time, created_by, last_edited_by) are available for filtering but not editable. For timestamp filters (created_time, last_edited_time), use the special format WITHOUT a 'property' field."
        }
    },
    errorFunction: formatError
})
