import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { Client } from '@notionhq/client';
import chalk from "chalk";
import { IntegrationType } from "../../../shared/Integrations";
import { NotionDatabaseSession } from "../NotionDatabaseOutput";

export const notionModifyPageTool = tool({
    name: 'notion_modify_page',
    description: `Create a new page (row) in the Notion database or update an existing page. This tool writes data to the database.

WHEN TO USE THIS TOOL:
- When you need to create a new row/page in the database
- When you need to update properties of an existing page
- When you need to add, modify, or remove data from the database
- After querying the database to find pages that need updates

WHAT THIS TOOL DOES:
1. Creates a new page if page_id is null (or not provided)
2. Updates an existing page if a valid page_id is provided
3. Sets or modifies database properties according to the provided properties_json

BEFORE USING THIS TOOL:
- Use notion_get_schema to understand the database structure, property names, types, and valid values
- For updates: Use notion_query_database to find the page_id of the page you want to update
- Ensure property names exactly match the database schema (case-sensitive)
- Use the exact format examples from notion_get_schema for each property type

PROPERTY FORMAT REQUIREMENTS:
Properties must use Notion's API format. The format depends on the property type:
- Title: {"PropertyName": {"title": [{"text": {"content": "value"}}]}}
- Rich Text: {"PropertyName": {"rich_text": [{"text": {"content": "value"}}]}}
- Number: {"PropertyName": {"number": 123}}
- Select: {"PropertyName": {"select": {"name": "OptionName"}}}
- Status: {"PropertyName": {"status": {"name": "StatusName"}}}
- Multi-select: {"PropertyName": {"multi_select": [{"name": "Tag1"}, {"name": "Tag2"}]}}
- Checkbox: {"PropertyName": {"checkbox": true}}
- Date: {"PropertyName": {"date": {"start": "2025-01-15"}}}
- URL: {"PropertyName": {"url": "https://example.com"}}
- Email: {"PropertyName": {"email": "user@example.com"}}

IMPORTANT:
- Property names must match exactly (case-sensitive) with the database schema
- Select/Status values must match exact option names from the schema
- Use notion_get_schema to get format_example for each property type
- page_id must be null (not empty string, not ".") to create a new page
- page_id must be a valid UUID from notion_query_database results to update`,
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
                return {
                    success: true,
                    action: 'updated',
                    page_id: response.id,
                };
            } else {
                // Create new page
                const response = await notion.pages.create({
                    parent: {
                        type: 'data_source_id',
                        data_source_id: runContext.context.notionConfig.database_id,
                    },
                    properties: properties as Record<string, any>,
                });
                console.log(chalk.green("Notion database modified successfully"));
                return {
                    success: true,
                    action: 'created',
                    page_id: response.id
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

