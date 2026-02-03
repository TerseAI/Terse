import { Client } from "@notionhq/client"
import { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints"
import { RunContext, tool } from "@openai/agents"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { NotionIntegrationManager } from "../../../integrations/NotionIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const notionModifyPageTool = tool({
    name: ToolName.NOTION_MODIFY_PAGE,
    description: `Create a new page (row) in the Notion database or update an existing page. This tool writes data to the database.

WHEN TO USE THIS TOOL:
- When you need to create a new row/page in the database
- When you need to update properties of an existing page
- When you need to add, modify, or remove data from the database
- After querying the database to find pages that need updates

WHAT THIS TOOL DOES:
1. Creates a new page if page_id is null (or not provided)
2. Updates an existing page if a valid page_id is provided
3. Sets or modifies database properties according to the provided properties_json

BEFORE USING THIS TOOL:
- Use notion_get_schema to understand the database structure, property names, types, and valid values
- For updates: Use notion_query_database to find the page_id of the page you want to update
- Ensure property names exactly match the database schema (case-sensitive)
- Use the exact format examples from notion_get_schema for each property type

PROPERTY FORMAT REQUIREMENTS:
Properties must use Notion's API format. The format depends on the property type:
- Title: {"PropertyName": {"title": [{"text": {"content": "value"}}]}}
- Rich Text: {"PropertyName": {"rich_text": [{"text": {"content": "value"}}]}}
- Number: {"PropertyName": {"number": 123}}
- Select: {"PropertyName": {"select": {"name": "OptionName"}}}
- Status: {"PropertyName": {"status": {"name": "StatusName"}}}
- Multi-select: {"PropertyName": {"multi_select": [{"name": "Tag1"}, {"name": "Tag2"}]}}
- Checkbox: {"PropertyName": {"checkbox": true}}
- Date: {"PropertyName": {"date": {"start": "2025-01-15"}}}
- URL: {"PropertyName": {"url": "https://example.com"}}
- Email: {"PropertyName": {"email": "user@example.com"}}

IMPORTANT:
- Property names must match exactly (case-sensitive) with the database schema
- Select/Status values must match exact option names from the schema
- Use notion_get_schema to get format_example for each property type
- page_id must be null (not empty string, not ".") to create a new page
- page_id must be a valid UUID from notion_query_database results to update`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        databaseId: z.string().describe("The Notion database ID (data source ID). Required when creating a new page."),
        page_id: z
            .string()
            .nullable()
            .describe(
                "The ID of the page to update (from notion_query_database). MUST be null (not empty string, not period) to create a new page. Only provide a valid page ID string to update an existing page."
            ),
        properties_json: z
            .string()
            .describe(
                'JSON string with property names as keys and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'
            )
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.NOTION_MODIFY_PAGE),
    execute: async ({ integrationId, databaseId, page_id, properties_json }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing notion_modify_page tool", { pageId: page_id ?? "(new page)", propertiesJson: properties_json })

        // Parse the JSON string
        let properties: Record<string, any>
        try {
            properties = JSON.parse(properties_json)
        } catch (error) {
            throw new Error("Invalid JSON in properties_json parameter. Ensure properties_json is a valid JSON string")
        }

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

        // Validate page_id - must be null or a valid UUID-like string (no slashes, periods, or other special chars)
        const validPageId = page_id && page_id.length > 30 && !page_id.includes("/") && page_id !== "." ? page_id : null

        // Helper function to get database name from data source
        const getDatabaseName = async (dataSourceId: string): Promise<string> => {
            try {
                const dataSourceInfo: GetDataSourceResponse = await notion.dataSources.retrieve({
                    data_source_id: dataSourceId
                })
                return "title" in dataSourceInfo ? dataSourceInfo.title?.[0]?.plain_text || "Unknown Database" : "Unknown Database"
            } catch (error) {
                logger.warn("Failed to retrieve data source info for database name", { dataSourceId, error })
                return "Unknown Database"
            }
        }

        try {
            if (validPageId) {
                // Update existing page
                const response = await notion.pages.update({
                    page_id: validPageId,
                    properties: properties as Record<string, any>
                })

                // Get database name from page's parent
                let databaseName = "Unknown Database"
                if ("parent" in response && response.parent && "type" in response.parent) {
                    if (response.parent.type === "data_source_id" && "data_source_id" in response.parent) {
                        databaseName = await getDatabaseName(response.parent.data_source_id)
                    } else if (response.parent.type === "database_id" && "database_id" in response.parent) {
                        // For database_id parent, we can try to retrieve it, but it might be a database not a data source
                        // In this case, we'll use a fallback
                        databaseName = "Notion database"
                    }
                }

                const pageUrl = "url" in response ? response.url : undefined
                const action = {
                    action: "Updated page",
                    integration: IntegrationType.NOTION,
                    target: databaseName,
                    details: "Updated page in database",
                    url: pageUrl,
                    type: "update"
                }
                return {
                    success: true,
                    action: "updated",
                    actions: [action],
                    page_id: response.id,
                    url: pageUrl
                }
            } else {
                // Create new page - get database name first
                const databaseName = await getDatabaseName(databaseId)

                const response = await notion.pages.create({
                    parent: {
                        type: "data_source_id",
                        data_source_id: databaseId
                    },
                    properties: properties as Record<string, any>
                })
                logger.info("Notion database modified successfully", { pageId: page_id ?? "(new page)", databaseId })

                const pageUrl = "url" in response ? response.url : undefined
                const action = {
                    action: "Created page",
                    integration: IntegrationType.NOTION,
                    target: databaseName,
                    details: "Created new page in database",
                    url: pageUrl,
                    type: "create"
                }
                return {
                    success: true,
                    action: "created",
                    actions: [action],
                    page_id: response.id,
                    url: pageUrl
                }
            }
        } catch (error: any) {
            const errorMessage = error.message || "Unknown error occurred"
            const hint = "Check that property names match the database schema and values are in correct Notion API format"
            throw new Error(`${errorMessage}. ${hint}`)
        }
    },
    errorFunction: formatError
})
