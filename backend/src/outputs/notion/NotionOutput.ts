import { Client } from "@notionhq/client"
import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { getACLOrNull, isPermitted } from "../../agent/acl/aclGuardrail"
import { getNotionAccessTokenOrThrow, validateNotionDatabasesExist, validateNotionPagesExist } from "../../integrations/NotionIntegration"
import logger from "../../logger"
import { NotionConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { ACLCheckContext, ACLCheckResult, ACLItem, ResourceType, createACLItem } from "../../shared/acl"
import { ToolName } from "../../tools/ToolNames"
import { PrismaTransaction } from "../../types/prisma"
import { getStringArg } from "../../utility/args"
import { NotionConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
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

const MAX_PARENT_TRAVERSAL_DEPTH = 10

type PageParent = { type?: string; data_source_id?: string; database_id?: string; page_id?: string }

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

    protected getDummyConfigForCapability(): NotionConfig {
        return new NotionConfig("example", ["example-db-id"], ["Example DB"], ["example-page-id"], ["Example Page"])
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

    async checkToolAccess(toolName: string, args: Record<string, unknown>, context: ACLCheckContext): Promise<ACLCheckResult> {
        switch (toolName) {
            case ToolName.NOTION_LIST_USERS:
                return { allowed: true }
            case ToolName.NOTION_QUERY_DATABASE:
            case ToolName.NOTION_GET_SCHEMA:
                return this.checkDatabaseAccess(args)
            case ToolName.NOTION_CREATE_OR_UPDATE_DATABASE_ROW:
                return this.checkDatabaseRowAccess(args, context)
            case ToolName.NOTION_CREATE_OR_UPDATE_PAGE:
                return this.checkPageCreateOrUpdateAccess(args, context)
            case ToolName.NOTION_QUERY_PAGE:
            case ToolName.NOTION_MODIFY_BLOCKS:
            case ToolName.NOTION_FETCH_RELATED_EVENTS:
                return this.checkPageScopedAccess(args, context, toolName)
            default:
                return { allowed: true }
        }
    }

    protected getSystemInstructionsForConfigs(configs: NotionConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Notion configs provided")
        }

        const sections: string[] = []
        sections.push("=== NOTION OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            const dbIds = config.databaseIds ?? []
            const dbNames = config.databaseNames ?? []
            const pageIds = config.pageIds ?? []
            const pageNames = config.pageNames ?? []
            const parts: string[] = [`Integration ID: ${config.integrationId}`]
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

    private checkDatabaseAccess(args: Record<string, unknown>): ACLCheckResult {
        const integrationId = getStringArg(args, "integrationId")
        const databaseId = getStringArg(args, "databaseId")

        if (!integrationId || !databaseId) {
            return { allowed: false, reason: "Notion database tools must include integrationId and databaseId." }
        }

        const acl = getACLOrNull(this.configs, integrationId)
        if (!acl) {
            return { allowed: false, reason: `Notion integration ${integrationId} is not configured for this agent.` }
        }

        if (isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.DATABASE, databaseId), acl)) {
            return { allowed: true }
        }

        return { allowed: false, reason: `Notion database ${databaseId} is outside the configured ACL for integration ${integrationId}.` }
    }

    private async checkDatabaseRowAccess(args: Record<string, unknown>, context: ACLCheckContext): Promise<ACLCheckResult> {
        const dbCheck = this.checkDatabaseAccess(args)
        if (!dbCheck.allowed) return dbCheck

        const integrationId = getStringArg(args, "integrationId")!
        const databaseId = getStringArg(args, "databaseId")!
        const pageId = getStringArg(args, "page_id")
        if (!pageId) return { allowed: true }

        try {
            const notion = await this.createNotionClient(integrationId)
            const parentDatabaseId = await this.resolvePageDatabaseId(pageId, notion)

            if (!parentDatabaseId) {
                return { allowed: false, reason: `Notion page ${pageId} is not a database row and cannot be updated with notion_create_or_update_database_row.` }
            }

            if (parentDatabaseId !== databaseId) {
                return { allowed: false, reason: `Notion page ${pageId} belongs to database ${parentDatabaseId}, but the tool call requested database ${databaseId}.` }
            }

            return { allowed: true }
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            logger.error("Failed to resolve Notion row ACL", { integrationId, databaseId, pageId, reason })
            return { allowed: false, reason: `Unable to verify Notion row ACL for page ${pageId}: ${reason}` }
        }
    }

    private async checkPageCreateOrUpdateAccess(args: Record<string, unknown>, context: ACLCheckContext): Promise<ACLCheckResult> {
        const pageId = getStringArg(args, "page_id")
        if (pageId) return this.checkPageAccess(args, context, pageId)

        const parentPageId = getStringArg(args, "parentPageId")
        if (!parentPageId) {
            return { allowed: false, reason: "notion_create_or_update_page create calls must include parentPageId." }
        }

        return this.checkPageAccess(args, context, parentPageId)
    }

    private async checkPageScopedAccess(args: Record<string, unknown>, context: ACLCheckContext, toolName: string): Promise<ACLCheckResult> {
        const pageId = getStringArg(args, "pageId")
        if (!pageId) {
            return { allowed: false, reason: `${toolName} must include pageId.` }
        }

        return this.checkPageAccess(args, context, pageId)
    }

    private async checkPageAccess(args: Record<string, unknown>, context: ACLCheckContext, pageId: string): Promise<ACLCheckResult> {
        const integrationId = getStringArg(args, "integrationId")

        if (!integrationId) {
            return { allowed: false, reason: "Notion page tools must include integrationId." }
        }

        const acl = getACLOrNull(this.configs, integrationId)
        if (!acl) {
            return { allowed: false, reason: `Notion integration ${integrationId} is not configured for this agent.` }
        }

        if (isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.PAGE, pageId), acl)) {
            return { allowed: true }
        }

        try {
            const notion = await this.createNotionClient(integrationId)
            const resolved = await this.resolvePageAccess(pageId, acl, notion)
            if (resolved.allowed) return { allowed: true }

            return { allowed: false, reason: `Notion page ${pageId} is outside the configured ACL for integration ${integrationId}.` }
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            logger.error("Failed to resolve Notion page ACL", { integrationId, pageId, reason })
            return { allowed: false, reason: `Unable to verify Notion ACL for page ${pageId}: ${reason}` }
        }
    }

    private async createNotionClient(integrationId: string): Promise<Client> {
        const accessToken = await getNotionAccessTokenOrThrow(integrationId)
        return new Client({ auth: accessToken })
    }

    private async getPageParent(pageId: string, notion: Client): Promise<PageParent | undefined> {
        const page = await notion.pages.retrieve({ page_id: pageId })
        return (page as { parent?: PageParent }).parent
    }

    private async resolvePageAccess(pageId: string, allowed: ACLItem[], notion: Client, depth = 0): Promise<{ allowed: boolean }> {
        if (depth >= MAX_PARENT_TRAVERSAL_DEPTH) return { allowed: false }

        const parent = await this.getPageParent(pageId, notion)
        if (!parent?.type) return { allowed: false }

        if ((parent.type === "data_source_id" && parent.data_source_id) || (parent.type === "database_id" && parent.database_id)) {
            const dbId = (parent.data_source_id ?? parent.database_id)!
            return { allowed: isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.DATABASE, dbId), allowed) }
        }

        if (parent.type === "page_id" && parent.page_id) {
            if (isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.PAGE, parent.page_id), allowed)) {
                return { allowed: true }
            }
            return this.resolvePageAccess(parent.page_id, allowed, notion, depth + 1)
        }

        return { allowed: false }
    }

    private async resolvePageDatabaseId(pageId: string, notion: Client, depth = 0): Promise<string | undefined> {
        if (depth >= MAX_PARENT_TRAVERSAL_DEPTH) return undefined

        const parent = await this.getPageParent(pageId, notion)
        if (!parent?.type) return undefined

        if (parent.type === "data_source_id") return parent.data_source_id
        if (parent.type === "database_id") return parent.database_id
        if (parent.type === "page_id" && parent.page_id) return this.resolvePageDatabaseId(parent.page_id, notion, depth + 1)

        return undefined
    }
}

const NOTION_FOOTER_INSTRUCTIONS = `
TERSE FOOTER (when updating page content): Ensure a **Terse Footer** at the very bottom of the page after any update. Default: divider block + heading_3 with "Updated by Terse 🫶 • Last sync: <Mon D, YYYY>" (Terse as link to https://useterse.ai). If the user specifies a custom footer in USER_INSTRUCTIONS, use that instead. Update an existing footer rather than duplicating.
`.trim()
