import { Output, OutputType, ToolboxEntry } from "./Output";
import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { Session } from "../../server";
import { Client } from '@notionhq/client';
import { NotionIntegration, AutomationOutput, User, AutomationNotionConfig } from "../../types/prisma";
import { db } from "../../prismaClient";
import chalk from "chalk";
import { RunHistoryAction } from "../../shared/RunHistoryTypes";

export interface NotionDatabaseSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionConfig: AutomationNotionConfig; // Configuration for the Specific Notion Database
    // Collect actions here (report-only); DB writes happen after agent finishes
    runActions?: RunHistoryAction[];
}

export class NotionDatabaseOutput extends Output<NotionDatabaseSession> {
    constructor() {
        const toolbox: ToolboxEntry<NotionDatabaseSession>[] = [
            { tool: notionQueryDatabaseTool, isReadOnly: true },
            { tool: notionModifyPageTool, isReadOnly: false },
        ];
        super(OutputType.Notion, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        automationOutputConfig: AutomationOutput,
        user: User
    ): Promise<NotionDatabaseSession> {
        // NotionOutput knows how to fetch its own integration
        const integration = await db().notion_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Notion integration ${integrationId} not found`);
        }

        const notionConfig: AutomationNotionConfig | null = await db().automation_notion_configs.findFirst({
            where: { automation_output_id: automationOutputConfig.id }
        });

        if (!notionConfig) {
            throw new Error(`Notion config for automation output ${automationOutputConfig.id} not found`);
        }

        return {
            notionIntegration: integration,
            notionConfig: notionConfig,
            user: user,
            isUserInitiated: true,
            // Collect actions from tools; will be persisted after run
            runActions: [],
        };
    }
}

// Helper function to extract readable values from Notion property objects
function extractPropertyValue(property: any): any {
    switch (property.type) {
        case 'title':
            return property.title.map((t: any) => t.plain_text).join('');
        case 'rich_text':
            return property.rich_text.map((t: any) => t.plain_text).join('');
        case 'number':
            return property.number;
        case 'select':
            return property.select?.name || null;
        case 'multi_select':
            return property.multi_select.map((s: any) => s.name);
        case 'date':
            return property.date;
        case 'checkbox':
            return property.checkbox;
        case 'url':
            return property.url;
        case 'email':
            return property.email;
        case 'phone_number':
            return property.phone_number;
        case 'status':
            return property.status?.name || null;
        case 'people':
            return property.people.map((p: any) => p.name || p.id);
        case 'files':
            return property.files.map((f: any) => f.name);
        case 'relation':
            return property.relation.map((r: any) => r.id);
        default:
            return null;
    }
}

// Tool 1: Query the Notion database to see current state AND schema
const notionQueryDatabaseTool = tool({
    name: 'notion_query_database',
    description: `ALWAYS CALL THIS FIRST. DO NOT MODIFY ANYTHING WITHOUT CALLING THIS FIRST.

This tool returns TWO critical pieces of information:
1. DATABASE SCHEMA: The structure of the database including:
   - Property names and their types (title, rich_text, select, status, number, date, etc.)
   - Valid options for select/multi_select/status fields
   - EXACT format examples showing how to construct each property type
   You MUST use the exact format from format_example when calling notion_modify_page.
2. CURRENT PAGES: All existing pages/rows with their current values in a readable format.

Use the schema's format_example field to construct properties correctly. Pay special attention to the difference between "select" and "status" types.`,
    parameters: z.object({
        // No parameters needed - returns all pages in the database
    }),
    execute: async ({ }, runContext?: RunContext<NotionDatabaseSession>) => {
        console.log("Executing notion_query_database tool");
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        // Fetch database schema
        const databaseInfo = await notion.databases.retrieve({
            database_id: runContext.context.notionConfig.database_id,
        });

        // Extract schema information with format examples
        const schema: Record<string, any> = {};
        for (const [propertyName, propertyConfig] of Object.entries(databaseInfo.properties as Record<string, any>)) {
            const baseSchema: any = {
                type: propertyConfig.type,
                id: propertyConfig.id,
            };

            // Add format examples for each type
            switch (propertyConfig.type) {
                case 'title':
                    baseSchema.format_example = `{"${propertyName}": {"title": [{"text": {"content": "Your text here"}}]}}`;
                    break;
                case 'rich_text':
                    baseSchema.format_example = `{"${propertyName}": {"rich_text": [{"text": {"content": "Your text here"}}]}}`;
                    break;
                case 'number':
                    baseSchema.format_example = `{"${propertyName}": {"number": 123}}`;
                    break;
                case 'select':
                    baseSchema.options = propertyConfig.select?.options?.map((opt: any) => opt.name) || [];
                    baseSchema.format_example = `{"${propertyName}": {"select": {"name": "OptionName"}}}`;
                    break;
                case 'multi_select':
                    baseSchema.options = propertyConfig.multi_select?.options?.map((opt: any) => opt.name) || [];
                    baseSchema.format_example = `{"${propertyName}": {"multi_select": [{"name": "Option1"}, {"name": "Option2"}]}}`;
                    break;
                case 'status':
                    baseSchema.options = propertyConfig.status?.options?.map((opt: any) => opt.name) || [];
                    baseSchema.format_example = `{"${propertyName}": {"status": {"name": "StatusOption"}}}`;
                    break;
                case 'date':
                    baseSchema.format_example = `{"${propertyName}": {"date": {"start": "2025-01-15"}}}`;
                    break;
                case 'checkbox':
                    baseSchema.format_example = `{"${propertyName}": {"checkbox": true}}`;
                    break;
                case 'url':
                    baseSchema.format_example = `{"${propertyName}": {"url": "https://example.com"}}`;
                    break;
                case 'email':
                    baseSchema.format_example = `{"${propertyName}": {"email": "user@example.com"}}`;
                    break;
            }

            schema[propertyName] = baseSchema;
        }

        // Fetch all pages
        const response = await notion.databases.query({
            database_id: runContext.context.notionConfig.database_id,
        });

        // Convert to readable format
        const pages = response.results.map((page: any) => {
            if (!page.properties) return null;

            // Extract all properties as simple key-value pairs
            const properties: Record<string, any> = {};
            for (const [key, value] of Object.entries(page.properties)) {
                properties[key] = extractPropertyValue(value);
            }

            return {
                page_id: page.id,
                properties: properties,
                url: page.url,
                created_time: page.created_time,
                last_edited_time: page.last_edited_time,
            };
        }).filter(Boolean);

        console.log("Notion query database tool response: ", { schema, pages_count: pages.length });

        return {
            database_schema: schema,
            total_pages: pages.length,
            pages: pages,
        };
    }
});

// Tool 2: Modify (create or update) pages in the Notion database
const notionModifyPageTool = tool({
    name: 'notion_modify_page',
    description: `Create a new page (row) in the database or update an existing one. If page_id is provided, updates that page. Otherwise, creates a new page.

IMPORTANT - Property Format:
Properties must use Notion's API format. Common examples:
- Title: {"PropertyName": {"title": [{"text": {"content": "value"}}]}}
- Rich Text: {"PropertyName": {"rich_text": [{"text": {"content": "value"}}]}}
- Number: {"PropertyName": {"number": 123}}
- Select: {"PropertyName": {"select": {"name": "Option"}}}
- Multi-select: {"PropertyName": {"multi_select": [{"name": "Tag1"}, {"name": "Tag2"}]}}
- Checkbox: {"PropertyName": {"checkbox": true}}
- Date: {"PropertyName": {"date": {"start": "2025-01-15"}}}
- URL: {"PropertyName": {"url": "https://example.com"}}
- Email: {"PropertyName": {"email": "user@example.com"}}

Use notion_query_database first to see existing property names and structure.`,
    parameters: z.object({
        page_id: z.string().nullable().describe('The ID of the page to update (from notion_query_database). MUST be null (not empty string, not period) to create a new page. Only provide a valid page ID string to update an existing page.'),
        properties_json: z.string().describe('JSON string with property names as keys and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'),
    }),
    needsApproval: async (_context, { page_id, properties_json }) => {
        return false; // DISABLE UNTIL HUMAN IN THE LOOP IS IMPLEMENTED
    },
    execute: async ({ page_id, properties_json }, runContext?: RunContext<NotionDatabaseSession>) => {
        console.log(chalk.bgMagenta.white.bold('🛠️ Executing notion_modify_page tool'));
        console.log(chalk.cyan('  Page ID: '), chalk.yellow(page_id ?? '(new page)'));
        console.log(chalk.cyan('  Properties JSON: '), chalk.greenBright(properties_json));

        // Parse the JSON string
        let properties: Record<string, any>;
        try {
            properties = JSON.parse(properties_json);
        } catch (error) {
            return {
                success: false,
                error: 'Invalid JSON in properties_json parameter',
                hint: 'Ensure properties_json is a valid JSON string'
            };
        }

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        // Validate page_id - must be null or a valid UUID-like string (no slashes, periods, or other special chars)
        const validPageId = page_id && page_id.length > 30 && !page_id.includes('/') && page_id !== '.' ? page_id : null;

        try {
            if (validPageId) {
                // Update existing page
                const response = await notion.pages.update({
                    page_id: validPageId,
                    properties: properties as Record<string, any>,
                });
                // Report action (no DB writes here)
                runContext.context.runActions = runContext.context.runActions || [];
                runContext.context.runActions.push({
                    action: 'update_page',
                    integration: 'notion',
                    target: runContext.context.notionConfig.database_name || runContext.context.notionConfig.database_id,
                    details: 'Notion page updated',
                    url: 'url' in response ? (response as any).url : undefined,
                });
                return {
                    success: true,
                    action: 'updated',
                    page_id: response.id,
                    url: 'url' in response ? response.url : undefined
                };
            } else {
                // Create new page
                const response = await notion.pages.create({
                    parent: {
                        type: 'database_id',
                        database_id: runContext.context.notionConfig.database_id,
                    },
                    properties: properties as Record<string, any>,
                });
                console.log(chalk.green("Notion database modified successfully"));
                // Report action (no DB writes here)
                runContext.context.runActions = runContext.context.runActions || [];
                runContext.context.runActions.push({
                    action: 'create_page',
                    integration: 'notion',
                    target: runContext.context.notionConfig.database_name || runContext.context.notionConfig.database_id,
                    details: 'Notion page created',
                    url: 'url' in response ? (response as any).url : undefined,
                });
                return {
                    success: true,
                    action: 'created',
                    page_id: response.id,
                    url: 'url' in response ? response.url : undefined
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                hint: 'Check that property names match the database schema and values are in correct Notion API format'
            };
        }
    }
});