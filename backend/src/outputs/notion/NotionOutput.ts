import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import {
    getNotionAccessTokenOrThrow,
    validateNotionDatabasesExist,
    validateNotionPagesExist
} from "../../integrations/NotionIntegration"
import { NotionConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { NotionConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { Output, ToolboxEntry } from "../abstract/Output"

import {
    fetchRelatedEventsTool,
    notionCreateOrUpdateDatabaseRowTool,
    notionCreateOrUpdatePageTool,
    notionGetSchemaTool,
    notionListUsersTool,
    notionModifyBlocksTool,
    notionQueryDatabaseTool,
    notionQueryPageTool
} from "./tools"

export class NotionOutput extends Output<NotionConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionGetSchemaTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Get datasource schema" },
            { tool: notionQueryDatabaseTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Query database" },
            { tool: notionCreateOrUpdateDatabaseRowTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION, displayName: "Create or update database row" },
            { tool: notionCreateOrUpdatePageTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION, displayName: "Create or update page (standalone)" },
            { tool: notionQueryPageTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Query page" },
            { tool: notionModifyBlocksTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION, displayName: "Modify blocks" },
            { tool: fetchRelatedEventsTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "Fetch related events" },
            { tool: notionListUsersTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION, displayName: "List workspace users" }
        ]
        super(OutputConfigType.NOTION, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.NOTION)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "Notion integration connection",
                databaseIds: "Allowed Notion database IDs (at least one database or page required)",
                databaseNames: "Display names for databases",
                pageIds: "Allowed Notion page IDs (at least one database or page required)",
                pageNames: "Display names for pages"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.NOTION,
            notion_config: {
                database_ids: ["example-db-id"],
                database_names: ["Example DB"],
                page_ids: ["example-page-id"],
                page_names: ["Example Page"]
            }
        })
    }

    async validateConfig(output: NotionConfig, _userId: string): Promise<void> {
        NotionConfigSchema.parse(stripConfigForValidation(output))
        const hasDb = (output.databaseIds?.length ?? 0) > 0
        const hasPage = (output.pageIds?.length ?? 0) > 0
        if (!hasDb && !hasPage) {
            throw new Error("Invalid Notion output config: you must supply at least one database or one page. Root-only (no page/database) is not supported.")
        }
        const token = await getNotionAccessTokenOrThrow(output.integrationId)
        await validateNotionDatabasesExist(token, output.databaseIds ?? [])
        await validateNotionPagesExist(token, output.pageIds ?? [])
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
**REQUIREMENT — You must have a root page or database:** Notion output requires at least one **allowed database** or one **allowed page** in the config above. There is no "workspace root only" mode — you must supply a page (to create subpages under and to modify) and/or a database (to query and add rows to).

**RESTRICTION — You may only edit within this scope:**
- **Databases:** Use only the database IDs listed above (must be Notion API UUID format). You may query and modify those databases and any **database entries** (rows/pages) that belong to them. Do not use any other database ID. Do not use a non-UUID or page ID as databaseId — the Notion API expects a UUID for database/data_source_id.
- **Pages:** Use only the page IDs listed above. You may query and modify those pages and **all of their subpages** (children, nested pages). Use \`parentPageId\` from this list when creating standalone subpages with \`notion_create_or_update_page\`. Never use \`integrationId\` as page_id or parentPageId — it is the connection identifier, not a Notion page.

When calling Notion tools, use \`integrationId\` only to identify the connection. Use a \`databaseId\` or \`pageId\` from the allowed list for database/page tools. Never use integrationId as databaseId, page_id, or parentPageId.`)

        sections.push(
            "\n**Database tools** (use with databaseId — must be UUID): `notion_get_schema`, `notion_query_database`, `notion_create_or_update_database_row`, `notion_list_users`. **Page tools:** `notion_create_or_update_page` (standalone subpages under an allowed parentPageId), `notion_query_page`, `notion_modify_blocks`, `notion_fetch_related_events`."
        )

        sections.push(`
CREATE OR UPDATE DATABASE ROW (\`notion_create_or_update_database_row\`): Use with \`databaseId\` (UUID only), \`page_id\` (null to create), \`properties_json\`. Use \`notion_get_schema\` first; do not create duplicates.

CREATE OR UPDATE PAGE (\`notion_create_or_update_page\`): For **standalone subpages** under an allowed page. Provide \`parentPageId\` (an allowed page ID from the list), \`title\`. Creates an empty page; always use \`notion_modify_blocks\` on the returned \`page_id\` to add content.

NOTION DATABASE WORKFLOW:
- Use \`notion_get_schema\` first to understand property names and types.
- Use \`notion_query_database\` to find existing records; prefer "contains"/"starts_with" over "equals".
- Use \`notion_create_or_update_database_row\` to create (page_id null) or update; do not create duplicates.

PEOPLE & RELATION PROPERTIES:
- Use \`notion_list_users\` to find user IDs for People properties (e.g., Assignee).
- For Relation properties, use \`notion_get_schema\` to find the related database ID,
  then \`notion_query_database\` on that database to find the target page ID.
`)

        sections.push("\n" + NOTION_FOOTER_INSTRUCTIONS)

        return sections.join("\n")
    }
}

const NOTION_FOOTER_INSTRUCTIONS = `
TERSE FOOTER (when updating page content): Ensure a **Terse Footer** at the very bottom of the page after any update. Default: divider block + heading_3 with "Updated by Terse 🫶 • Last sync: <Mon D, YYYY>" (Terse as link to https://useterse.ai). If the user specifies a custom footer in USER_INSTRUCTIONS, use that instead. Update an existing footer rather than duplicating.
`.trim()
