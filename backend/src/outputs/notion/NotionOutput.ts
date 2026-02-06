import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { NotionConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import {
    fetchRelatedEventsTool,
    notionGetSchemaTool,
    notionModifyBlocksTool,
    notionModifyPageTool,
    notionQueryDatabaseTool,
    notionQueryPageTool
} from "./tools"

export class NotionOutput extends Output<NotionConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionGetSchemaTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Get datasource schema" },
            { tool: notionQueryDatabaseTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Query database" },
            { tool: notionModifyPageTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION, displayName: "Modify page (database row)" },
            { tool: notionQueryPageTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Query page" },
            { tool: notionModifyBlocksTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION, displayName: "Modify blocks" },
            { tool: fetchRelatedEventsTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Fetch related events" }
        ]
        super(OutputConfigType.NOTION, toolbox)
    }

    async validateConfig(output: NotionConfig, _userId: string): Promise<void> {
        if (!output.databaseId && !output.pageId) {
            throw new Error("Invalid Notion output config: at least one of databaseId or pageId is required")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: NotionConfig): Promise<void> {
        await tx.automation_notion_configs.create({
            data: {
                automation_output_id: channelOutputId,
                database_id: output.databaseId ?? null,
                database_name: output.databaseName ?? null,
                page_id: output.pageId ?? null,
                page_name: output.pageName ?? null
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Notion configs provided")
        }

        const sections: string[] = []
        sections.push("=== NOTION OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            if (!config.notion_config) {
                throw new Error("Notion config not found")
            }
            const nc = config.notion_config
            const parts: string[] = [`Integration ID: ${config.integration_id}`]
            if (nc.database_id || nc.database_name) {
                parts.push(`Database: ${nc.database_name || nc.database_id || "N/A"} (databaseId: ${nc.database_id || "—"})`)
            }
            if (nc.page_id || nc.page_name) {
                parts.push(`Page: ${nc.page_name || nc.page_id || "N/A"} (pageId: ${nc.page_id || "—"})`)
            }
            configList.push(`  • ${parts.join(" | ")}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Notion tools, use the `integrationId` and the appropriate target ID (databaseId for database tools, pageId for page tools) from the list above.")

        sections.push("\n**Database tools** (use with databaseId): `notion_get_schema`, `notion_query_database`, `notion_modify_page`. **Page tools** (use with pageId): `notion_query_page`, `notion_modify_blocks`, `notion_fetch_related_events`. You can create a page in a database then add content to a page; use the right tool and target for each step.")

        sections.push(`
NOTION DATABASE WORKFLOW (when using databaseId):
- Use \`notion_get_schema\` first to understand property names and types.
- Use \`notion_query_database\` to find existing records; prefer "contains"/"starts_with" over "equals".
- Use \`notion_modify_page\` to create (page_id null) or update; do not create duplicates.
`)

        sections.push("\n" + NOTION_FOOTER_INSTRUCTIONS)

        return sections.join("\n")
    }
}

const NOTION_FOOTER_INSTRUCTIONS = `
TERSE FOOTER (when updating page content): Ensure a **Terse Footer** at the very bottom of the page after any update. Default: divider block + heading_3 with "Updated by Terse 🫶 • Last sync: <Mon D, YYYY>" (Terse as link to https://useterse.ai). If the user specifies a custom footer in USER_INSTRUCTIONS, use that instead. Update an existing footer rather than duplicating.
`.trim()
