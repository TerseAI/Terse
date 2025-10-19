import { Output } from "./Output";
import { OutputType } from "./Output";
import { RunContext, Tool, tool } from "@openai/agents";
import { z } from "zod";
import { Session } from "../../server";
import { Client } from '@notionhq/client';
import { NotionIntegration } from "src/types/prisma";
import chalk from "chalk";

export interface NotionSession extends Session {
    notionIntegration: NotionIntegration;
}

export class NotionOutput extends Output<NotionSession> {
    constructor() {
        const toolbox = [notionQueryDatabaseTool, notionModifyPageTool];
        super(OutputType.Notion, toolbox);
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

// Tool 1: Query the Notion database to see current state
const notionQueryDatabaseTool = tool({
    name: 'notion_query_database',
    description: 'ALWAYS CALL THIS FIRST. DO NOT MODIFY ANYTHING WITHOUT CALLING THIS FIRST. Query the Notion database to retrieve all current pages/rows and their properties. Use this to "grep" through the database and understand its current state before making any modifications. Returns pages in a readable format with their IDs and property values.',
    parameters: z.object({
        // No parameters needed - returns all pages in the database
    }),
    execute: async ({}, runContext?: RunContext<NotionSession>) => {
        console.log("Executing notion_query_database tool");
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });
        
        const response = await notion.databases.query({
            database_id: runContext.context.notionIntegration.database_id,
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

        return {
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
        page_id: z.string().nullable().describe('The ID of the page to update (from notion_query_database). If null, creates a new page.'),
        properties_json: z.string().describe('JSON string with property names as keys and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'),
    }),
    execute: async ({ page_id, properties_json }, runContext?: RunContext<NotionSession>) => {
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

        try {
            if (page_id) {
                // Update existing page
                const response = await notion.pages.update({
                    page_id: page_id,
                    properties: properties as Record<string, any>,
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
                        database_id: runContext.context.notionIntegration.database_id,
                    },
                    properties: properties as Record<string, any>,
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