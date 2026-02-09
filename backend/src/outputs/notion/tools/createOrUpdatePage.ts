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

const VALID_PAGE_ID_MIN_LENGTH = 30

function isValidPageId(pageId: string | null | undefined): pageId is string {
    return !!(pageId && pageId.length >= VALID_PAGE_ID_MIN_LENGTH && !pageId.includes("/") && pageId !== ".")
}

export const notionCreateOrUpdatePageTool = tool({
    name: ToolName.NOTION_CREATE_OR_UPDATE_PAGE,
    description: `Create or update a **standalone page**. Not for database entries — use notion_create_or_update_database_row for those.

**Create**: Omit page_id (or pass null). Supply parentPageId (allowed page ID from config), title; optionally children (JSON array of blocks). Creates a new subpage under the parent.
**Update**: Pass page_id of an existing page to update its title. parentPageId and children are ignored when updating. Use notion_modify_blocks to change page content.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        page_id: z.string().nullable().optional().describe("ID of an existing page to update. Omit or null to create a new subpage under parentPageId."),
        parentPageId: z
            .string()
            .optional()
            .nullable()
            .describe("Required for create: the allowed page ID under which to create the new subpage (from the Notion config list). Ignored when page_id is provided for update."),
        title: z.string().describe("The page title (used for both create and update)."),
        children: z
            .string()
            .optional()
            .nullable()
            .describe("Optional JSON array of block objects for initial content (Notion block format). Only used when creating; omit to create empty page and use notion_modify_blocks after.")
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.NOTION_CREATE_OR_UPDATE_PAGE),
    execute: async ({ integrationId, page_id, parentPageId, title, children }, runContext?: RunContext<SessionWithTracking<Session>>) => {
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
            throw new Error("title is required")
        }

        const updatingExisting = isValidPageId(page_id)

        if (updatingExisting) {
            try {
                const response = await notion.pages.update({
                    page_id: page_id!,
                    properties: {
                        title: {
                            title: [{ text: { content: title.trim() } }]
                        }
                    } as Record<string, any>
                })
                const pageUrl = "url" in response ? response.url : undefined
                logger.info("Notion standalone page updated", { pageId: response.id })
                return {
                    success: true,
                    action: "updated",
                    actions: [
                        {
                            action: "Updated page",
                            integration: IntegrationType.NOTION,
                            target: "Page",
                            details: "Updated page title",
                            url: pageUrl,
                            type: "update"
                        }
                    ],
                    page_id: response.id,
                    url: pageUrl
                }
            } catch (error: any) {
                throw new Error(error.message || "Failed to update standalone page")
            }
        }

        if (!parentPageId || parentPageId.trim() === "") {
            throw new Error("parentPageId is required when creating a new page (omit page_id to create)")
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
