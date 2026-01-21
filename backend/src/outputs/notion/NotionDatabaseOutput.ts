import { Output, ToolboxEntry } from "../abstract/Output";
import { Tool } from "@openai/agents";
import { Session } from "../../server";
import { NotionIntegration, AgentOutput, User, AgentNotionConfig, PrismaTransaction } from "../../types/prisma";
import { db } from "../../prismaClient";
import { NotionConfig } from "../../shared/Configs";
import { OutputConfigType } from "@prisma/client";
import { notionQueryDatabaseTool, notionModifyPageTool, notionGetSchemaTool } from "./tools";
import { IntegrationType } from "../../shared/Integrations";

export interface NotionDatabaseSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionConfig: AgentNotionConfig; // Configuration for the Specific Notion Database
}

export class NotionDatabaseOutput extends Output<NotionDatabaseSession, NotionConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionGetSchemaTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION },
            { tool: notionQueryDatabaseTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION },
            { tool: notionModifyPageTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION },
        ];
        super(OutputConfigType.NOTION_DATABASE, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        agentOutputConfig: AgentOutput,
        user: User
    ): Promise<NotionDatabaseSession> {
        // NotionOutput knows how to fetch its own integration
        const integration = await db().notion_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Notion integration ${integrationId} not found`);
        }

        const notionConfig: AgentNotionConfig | null = await db().automation_notion_configs.findFirst({
            where: { automation_output_id: agentOutputConfig.id }
        });

        if (!notionConfig) {
            throw new Error(`Notion config for agent output ${agentOutputConfig.id} not found`);
        }

        return {
            notionIntegration: integration,
            notionConfig: notionConfig,
            user: user,
            isUserInitiated: true,
        };
    }

    async validateConfig(output: NotionConfig, _userId: string): Promise<void> {
        if (!output.databaseId) {
            throw new Error('Invalid output config for notion_database: missing databaseId');
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: NotionConfig): Promise<void> {
        await tx.automation_notion_configs.create({
            data: {
                automation_output_id: agentOutputId,
                database_id: output.databaseId || '',
                database_name: output.databaseName || '',
            },
        });
    }

    getSystemInstructions(session: NotionDatabaseSession): string {
        return `
==========================
NOTION DATABASE OUTPUT INSTRUCTIONS
==========================
CRITICAL WORKFLOW: Before querying or modifying database entries, you MUST follow this sequence:

STEP 1: UNDERSTAND THE SCHEMA FIRST
- ALWAYS use the \`notion_get_schema\` tool FIRST to understand the database structure
- Review all available properties, their types, and any constraints
- Identify which properties are suitable for:
  - Identifying unique records (title fields, unique IDs, etc.)
  - Filtering queries
  - Updating records
- This schema information is essential for constructing correct queries and updates

STEP 2: CHECK FOR EXISTING RECORDS
- After understanding the schema, use the \`notion_query_database\` tool to search for existing records
- Use the schema information to construct appropriate filters based on:
  - Title or name fields
  - Unique identifiers (IDs, ticket numbers, etc.)
  - Key metadata that would indicate the same record
- Query using property names and types that match the schema
- IMPORTANT: Use KEYWORD SEARCHES (e.g., "contains", "starts_with") rather than exact matches ("equals")
  - Keyword searches are more flexible and will find relevant records even with slight variations
  - Use "contains" for text properties to find records with matching keywords
  - Use "starts_with" if you need records that begin with specific text
  - Avoid "equals" unless you need an exact match (rare)

STEP 3: CREATE OR UPDATE
- If a matching record is found:
  - DO NOT create a duplicate entry
  - Update the existing record using \`notion_modify_page\` tool
  - Use property names and types that match the schema
  - In your rationale, note that you updated an existing record rather than creating a new one
- Only create a new entry if your query confirms no matching record exists
- When creating or updating, ensure all property names and types match the schema exactly

WHEN TO CHECK SCHEMA:
- At the start of any database operation
- Before constructing any query filters
- Before updating any record properties
- If you're unsure about property names or types

QUERY STRATEGY:
- Use the schema to identify the correct property names for filters
- Match filter types to property types (e.g., use "rich_text" filter for text properties, "number" for number properties)
- PREFER KEYWORD SEARCHES over exact matches:
  - For text properties (title, rich_text): Use "contains" to search for keywords within the text
  - Use "starts_with" if you need records that begin with specific text
  - Only use "equals" when you absolutely need an exact match (very rare)
  - Keyword searches are more forgiving and will catch variations, typos, or partial matches
- Be thoughtful about what makes a record "duplicate" - consider the context
- If multiple similar records exist, prefer updating the most relevant one
- Extract key keywords from the content you're trying to match (e.g., ticket titles, project names) and search for those keywords

This workflow ensures you work with the database correctly and prevents duplicate entries.
`;
    }
}

