import { OutputConfigType } from "@prisma/client"
import { NotionConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { getNotionAccessTokenOrThrow, validateNotionDatabasesExist, validateNotionPagesExist } from "../../integrations/NotionIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output, defineToolboxEntry, formatConfigAccess, mixedReadWriteToolInstructionParagraph, outputHasMixedReadOnlyAndWritable, outputIsReadOnly } from "../abstract/Output"

import {
    validateNotionCreateOrUpdatePageACL,
    validateNotionDatabaseACL,
    validateNotionDatabaseRowACL,
    validateNotionIntegrationACL,
    validateNotionReadPageACL,
    validateNotionWritePageACL
} from "./acl"
import {
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
        const toolbox = [
            defineToolboxEntry({
                tool: notionGetSchemaTool,
                isReadOnly: true,
                integration: IntegrationType.NOTION,
                displayName: "Get datasource schema",
                validateACL: validateNotionDatabaseACL
            }),
            defineToolboxEntry({
                tool: notionQueryDatabaseTool,
                isReadOnly: true,
                integration: IntegrationType.NOTION,
                displayName: "Query database",
                validateACL: validateNotionDatabaseACL
            }),
            defineToolboxEntry({
                tool: notionCreateOrUpdateDatabaseRowTool,
                isReadOnly: false,
                integration: IntegrationType.NOTION,
                displayName: "Create or update database row",
                validateACL: validateNotionDatabaseRowACL
            }),
            defineToolboxEntry({
                tool: notionCreateOrUpdatePageTool,
                isReadOnly: false,
                integration: IntegrationType.NOTION,
                displayName: "Create or update page (standalone)",
                validateACL: validateNotionCreateOrUpdatePageACL
            }),
            defineToolboxEntry({
                tool: notionQueryPageTool,
                isReadOnly: true,
                integration: IntegrationType.NOTION,
                displayName: "Query page",
                validateACL: validateNotionReadPageACL
            }),
            defineToolboxEntry({
                tool: notionModifyBlocksTool,
                isReadOnly: false,
                integration: IntegrationType.NOTION,
                displayName: "Modify blocks",
                validateACL: validateNotionWritePageACL
            }),
            defineToolboxEntry({
                tool: notionListUsersTool,
                isReadOnly: true,
                integration: IntegrationType.NOTION,
                displayName: "List workspace users",
                validateACL: validateNotionIntegrationACL
            })
        ]
        super(OutputConfigType.NOTION, toolbox)
    }

    protected getDummyConfigForCapability(): NotionConfig {
        return new NotionConfig("example", ["example-db-id"], ["Example DB"], ["example-page-id"], ["Example Page"])
    }

    async validateConfig(output: NotionConfig, _userId: string): Promise<void> {
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

    protected getSystemInstructionsForConfigs(configs: NotionConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Notion configs provided")
        }

        const readOnly = outputIsReadOnly(configs)

        const sections: string[] = []
        sections.push(readOnly ? "=== NOTION OUTPUT (READ-ONLY) ===" : "=== NOTION OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            const access = formatConfigAccess(config)
            const dbIds = config.databaseIds ?? []
            const dbNames = config.databaseNames ?? []
            const pageIds = config.pageIds ?? []
            const pageNames = config.pageNames ?? []
            const lines: string[] = [`  • Integration ID: ${config.integrationId}`, `    Access: ${access}`]
            if (dbIds.length > 0) {
                lines.push(`    Databases: ${dbIds.map((id, i) => `${dbNames[i] || id} (${id})`).join("; ")}`)
            }
            if (pageIds.length > 0) {
                lines.push(`    Pages: ${pageIds.map((id, i) => `${pageNames[i] || id} (${id})`).join("; ")}`)
            }
            configList.push(lines.join("\n"))
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        if (outputHasMixedReadOnlyAndWritable(configs)) {
            sections.push(mixedReadWriteToolInstructionParagraph())
        }

        if (readOnly) {
            sections.push(`
**This Notion integration is read-only for this run.** You can read and inspect Notion content but cannot create or update anything.

**RESTRICTION — You may only read within this scope:**
- **Databases:** Use only the database IDs listed above (must be Notion API UUID format). You may query those databases and read any of their rows.
- **Pages:** Use only the page IDs listed above. You may read those pages and any of their subpages (children, nested pages).

When calling Notion tools, use \`integrationId\` only to identify the connection. Use a \`databaseId\` or \`pageId\` from the allowed list. Never use integrationId as databaseId or pageId.`)

            sections.push("\n**Read-only tools available:** `notion_get_schema`, `notion_query_database`, `notion_query_page`, `notion_list_users`.")
        } else {
            sections.push(`
**REQUIREMENT — You must have a root page or database:** Notion output requires at least one **allowed database** or one **allowed page** in the config above. There is no "workspace root only" mode — you must supply a page (to create subpages under and to modify) and/or a database (to query and add rows to).

**RESTRICTION — You may only edit within this scope:**
- **Databases:** Use only the database IDs listed above (must be Notion API UUID format). You may query and modify those databases and any **database entries** (rows/pages) that belong to them. Do not use any other database ID. Do not use a non-UUID or page ID as databaseId — the Notion API expects a UUID for database/data_source_id.
- **Pages:** Use only the page IDs listed above. You may query and modify those pages and **all of their subpages** (children, nested pages). Use \`parentPageId\` from this list when creating standalone subpages with \`notion_create_or_update_page\`. Never use \`integrationId\` as page_id or parentPageId — it is the connection identifier, not a Notion page.

When calling Notion tools, use \`integrationId\` only to identify the connection. Use a \`databaseId\` or \`pageId\` from the allowed list for database/page tools. Never use integrationId as databaseId, page_id, or parentPageId.`)

            sections.push(
                "\n**Database tools** (use with databaseId — must be UUID): `notion_get_schema`, `notion_query_database`, `notion_create_or_update_database_row`, `notion_list_users`. **Page tools:** `notion_create_or_update_page` (standalone subpages under an allowed parentPageId), `notion_query_page`, `notion_modify_blocks`."
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
        }

        return sections.join("\n")
    }
}

const NOTION_FOOTER_INSTRUCTIONS = `
TERSE FOOTER (when updating page content): Ensure a **Terse Footer** at the very bottom of the page after any update. Default: divider block + heading_3 with "Updated by Terse 🫶 • Last sync: <Mon D, YYYY>" (Terse as link to https://useterse.ai). If the user specifies a custom footer in USER_INSTRUCTIONS, use that instead. Update an existing footer rather than duplicating.
`.trim()
