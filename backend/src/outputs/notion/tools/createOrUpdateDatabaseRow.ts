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

export const notionCreateOrUpdateDatabaseRowTool = tool({
    name: ToolName.NOTION_CREATE_OR_UPDATE_DATABASE_ROW,
    description: `Create or update a **row** (entry) in a Notion database. Use with databaseId and properties_json. Not for standalone pages — use notion_create_or_update_page for those.

Use notion_get_schema first to understand property names and types. Use notion_query_database to find page_id for updates. Provide page_id null to create a new row, or a valid page_id to update. Property format: Title, Rich Text, Select, Status, etc. per notion_get_schema.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        databaseId: z.string().describe("The Notion database ID (data source ID)."),
        page_id: z.string().nullable().describe("The ID of the row to update (from notion_query_database). MUST be null to create a new row. Provide a valid page ID to update an existing row."),
        properties_json: z
            .string()
            .describe(
                'JSON string with property names and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'
            )
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.NOTION_CREATE_OR_UPDATE_DATABASE_ROW),
    execute: async ({ integrationId, databaseId, page_id, properties_json }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing notion_create_or_update_database_row", { pageId: page_id ?? "(new row)", databaseId })

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

        const notion = new Client({ auth: accessToken })

        const validPageId = page_id && page_id.length > 30 && !page_id.includes("/") && page_id !== "." ? page_id : null

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
                const response = await notion.pages.update({
                    page_id: validPageId,
                    properties: properties as Record<string, any>
                })

                let databaseName = "Unknown Database"
                if ("parent" in response && response.parent && "type" in response.parent) {
                    if (response.parent.type === "data_source_id" && "data_source_id" in response.parent) {
                        databaseName = await getDatabaseName(response.parent.data_source_id)
                    } else if (response.parent.type === "database_id" && "database_id" in response.parent) {
                        databaseName = "Notion database"
                    }
                }

                const pageUrl = "url" in response ? response.url : undefined
                return {
                    success: true,
                    action: "updated",
                    actions: [
                        {
                            action: "Updated page",
                            integration: IntegrationType.NOTION,
                            target: databaseName,
                            details: "Updated row in database",
                            url: pageUrl,
                            type: "update"
                        }
                    ],
                    page_id: response.id,
                    url: pageUrl
                }
            } else {
                const databaseName = await getDatabaseName(databaseId)

                const response = await notion.pages.create({
                    parent: { type: "data_source_id", data_source_id: databaseId },
                    properties: properties as Record<string, any>
                })
                logger.info("Notion database row created", { databaseId, pageId: response.id })

                const pageUrl = "url" in response ? response.url : undefined
                return {
                    success: true,
                    action: "created",
                    actions: [
                        {
                            action: "Created page",
                            integration: IntegrationType.NOTION,
                            target: databaseName,
                            details: "Created new row in database",
                            url: pageUrl,
                            type: "create"
                        }
                    ],
                    page_id: response.id,
                    url: pageUrl
                }
            }
        } catch (error: any) {
            const hint = "Check that property names match the database schema and values are in correct Notion API format"
            throw new Error(`${error.message || "Unknown error"}. ${hint}`)
        }
    },
    errorFunction: formatError
})
