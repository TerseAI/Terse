import { Client } from "@notionhq/client"
import { RunContext, tool } from "@openai/agents"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { NotionIntegrationManager } from "../../../integrations/NotionIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const notionCreateOrUpdatePageTool = tool({
    name: ToolName.NOTION_CREATE_OR_UPDATE_PAGE,
    description: `Create a **standalone subpage** under an allowed page. Not for database entries — use notion_create_or_update_database_row for those. You must supply a parent page (from the Notion config allowed list). Provide parentPageId (allowed page ID), title; optionally children (JSON array of blocks). Use notion_modify_blocks on the returned page_id to add content.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        parentPageId: z.string().describe("The allowed page ID under which to create the new subpage (from the Notion config list)."),
        title: z.string().describe("The page title."),
        children: z
            .string()
            .optional()
            .nullable()
            .describe(
                "Optional JSON array of block objects for initial content (Notion block format). Omit to create empty page and use notion_modify_blocks after."
            )
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.NOTION_CREATE_OR_UPDATE_PAGE),
    execute: async (
        { integrationId, parentPageId, title, children },
        runContext?: RunContext<SessionWithTracking<Session>>
    ) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new NotionIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Notion integration not found or access denied for integrationId: ${integrationId}`)
        }

        const notion = new Client({ auth: accessToken })

        if (title == null || title.trim() === "") {
            throw new Error("title is required for standalone page creation")
        }
        if (!parentPageId || parentPageId.trim() === "") {
            throw new Error("parentPageId is required (create subpage under an allowed page from the config)")
        }

        const parent = { type: "page_id" as const, page_id: parentPageId }

        const properties = {
            title: {
                title: [{ text: { content: title.trim() } }]
            }
        }

        type CreateParams = {
            parent: typeof parent
            properties: typeof properties
            children?: any[]
        }
        const createParams: CreateParams = { parent, properties }
        if (children != null && children !== "") {
            try {
                const parsed = JSON.parse(children)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    createParams.children = parsed
                }
            } catch {
                logger.warn("Invalid children JSON for standalone page; creating page without initial blocks")
            }
        }

        try {
            const response = await notion.pages.create(createParams as any)
            const pageUrl = "url" in response ? response.url : undefined
            logger.info("Notion standalone subpage created", { parentPageId, pageId: response.id })
            return {
                success: true,
                action: "created",
                actions: [
                    {
                        action: "Created page",
                        integration: IntegrationType.NOTION,
                        target: "Page",
                        details: "Created new subpage under allowed parent",
                        url: pageUrl,
                        type: "create"
                    }
                ],
                page_id: response.id,
                url: pageUrl
            }
        } catch (error: any) {
            throw new Error(error.message || "Failed to create standalone page")
        }
    },
    errorFunction: formatError
})
