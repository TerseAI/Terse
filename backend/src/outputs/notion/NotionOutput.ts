import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { NotionConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { fetchRelatedEventsTool, notionGetSchemaTool, notionModifyBlocksTool, notionModifyPageTool, notionQueryDatabaseTool, notionQueryPageTool } from "./tools"

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
        const hasDb = (output.databaseIds?.length ?? 0) > 0
        const hasPage = (output.pageIds?.length ?? 0) > 0
        if (!hasDb && !hasPage) {
            throw new Error("Invalid Notion output config: at least one of databaseIds or pageIds must be non-empty")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: NotionConfig): Promise<void> {
        await tx.automation_notion_configs.create({
            data: {
                automation_output_id: channelOutputId,
                database_ids: output.databaseIds ?? [],
                database_names: output.databaseNames ?? [],
                page_ids: output.pageIds ?? [],
                page_names: output.pageNames ?? []
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
            const dbIds = nc.database_ids ?? []
            const dbNames = nc.database_names ?? []
            const pageIds = nc.page_ids ?? []
            const pageNames = nc.page_names ?? []
            const parts: string[] = [`Integration ID: ${config.integration_id}`]
            if (dbIds.length > 0) {
                parts.push(`Allowed databases: ${dbIds.map((id, i) => `${dbNames[i] || id} (${id})`).join("; ")}`)
            }
            if (pageIds.length > 0) {
                parts.push(`Allowed pages: ${pageIds.map((id, i) => `${pageNames[i] || id} (${id})`).join("; ")}`)
            }
            configList.push(`  • ${parts.join(" | ")}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push(`
**RESTRICTION — You may only edit within this scope:**
- **Databases:** Use only the database IDs listed above. You may query and modify those databases and any **database entries** (rows/pages) that belong to them. Do not use any other database ID.
- **Pages:** Use only the page IDs listed above. You may query and modify those pages and **all of their subpages** (children, nested pages). Do not use any other page ID as a target.

When calling Notion tools, always use the \`integrationId\` and a \`databaseId\` or \`pageId\` from the allowed list above. Never target a database or page that is not in the list.`)

        sections.push(
            "\n**Database tools** (use with databaseId): `notion_get_schema`, `notion_query_database`, `notion_modify_page`. **Page tools** (use with pageId): `notion_query_page`, `notion_modify_blocks`, `notion_fetch_related_events`. You can create a page in a database then add content to a page; use the right tool and target for each step."
        )

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
