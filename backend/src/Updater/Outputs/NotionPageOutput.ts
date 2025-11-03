import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { RunContext, tool } from "@openai/agents";
import { AutomationNotionPageConfig, AutomationOutput, NotionIntegration, User } from "../../types/prisma";
import { Session } from "../../server";
import { Client } from '@notionhq/client';
import { z } from "zod";
import { Output, OutputType } from "./Output";
import { db } from "../../prismaClient";
import chalk from "chalk";
import { GetPageResponse, PageObjectResponse, PartialPageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export interface NotionPageSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionPageConfig: AutomationNotionPageConfig; // Configuration for the Specific Notion Page
    // Collect actions here (report-only); DB writes happen after agent finishes
    runActions?: RunHistoryAction[];
}

export class NotionPageOutput extends Output<NotionPageSession> {
    constructor() {
        const toolbox = [notionQueryPageTool, notionModifyPageTool];
        super(OutputType.NotionPage, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        automationOutputConfig: AutomationOutput,
        user: User
    ): Promise<NotionPageSession> {
        const integration = await db().notion_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Notion integration ${integrationId} not found`);
        }

        const notionPageConfig: AutomationNotionPageConfig | null = await db().automation_notion_page_configs.findFirst({
            where: { automation_output_id: automationOutputConfig.id }
        });

        if (!notionPageConfig) {
            throw new Error(`Notion page config for automation output ${automationOutputConfig.id} not found`);
        }

        return { notionIntegration: integration, notionPageConfig: notionPageConfig, user: user, isUserInitiated: true, runActions: [] };
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
            return property.people.map((p: any) => ({ id: p.id, name: p.name || undefined }));
        case 'files':
            return property.files.map((f: any) => ({ 
                name: f.name, 
                type: f.type,
                file: f.file?.url || undefined,
                external: f.external?.url || undefined
            }));
        case 'relation':
            return property.relation.map((r: any) => r.id);
        case 'rollup':
            return property.rollup;
        case 'formula':
            return property.formula;
        case 'created_by':
            return property.created_by ? { id: property.created_by.id, name: property.created_by.name || undefined } : null;
        case 'created_time':
            return property.created_time;
        case 'last_edited_by':
            return property.last_edited_by ? { id: property.last_edited_by.id, name: property.last_edited_by.name || undefined } : null;
        case 'last_edited_time':
            return property.last_edited_time;
        default:
            return null;
    }
}

// Helper function to extract text content from a block
function extractBlockContent(block: any): any {
    const baseBlock = {
        id: block.id,
        type: block.type,
        object: block.object,
        created_time: block.created_time,
        last_edited_time: block.last_edited_time,
        created_by: block.created_by ? { id: block.created_by.id, name: block.created_by.name || undefined } : undefined,
        last_edited_by: block.last_edited_by ? { id: block.last_edited_by.id, name: block.last_edited_by.name || undefined } : undefined,
        has_children: block.has_children,
        archived: block.archived,
    };

    // Extract content based on block type
    switch (block.type) {
        case 'paragraph':
            return {
                ...baseBlock,
                content: block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.paragraph?.rich_text || [],
            };
        case 'heading_1':
            return {
                ...baseBlock,
                content: block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.heading_1?.rich_text || [],
            };
        case 'heading_2':
            return {
                ...baseBlock,
                content: block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.heading_2?.rich_text || [],
            };
        case 'heading_3':
            return {
                ...baseBlock,
                content: block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.heading_3?.rich_text || [],
            };
        case 'bulleted_list_item':
            return {
                ...baseBlock,
                content: block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.bulleted_list_item?.rich_text || [],
            };
        case 'numbered_list_item':
            return {
                ...baseBlock,
                content: block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.numbered_list_item?.rich_text || [],
            };
        case 'to_do':
            return {
                ...baseBlock,
                content: block.to_do?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.to_do?.rich_text || [],
                checked: block.to_do?.checked || false,
            };
        case 'toggle':
            return {
                ...baseBlock,
                content: block.toggle?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.toggle?.rich_text || [],
            };
        case 'code':
            return {
                ...baseBlock,
                content: block.code?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.code?.rich_text || [],
                language: block.code?.language || '',
            };
        case 'quote':
            return {
                ...baseBlock,
                content: block.quote?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.quote?.rich_text || [],
            };
        case 'callout':
            return {
                ...baseBlock,
                content: block.callout?.rich_text?.map((t: any) => t.plain_text).join('') || '',
                rich_text: block.callout?.rich_text || [],
                icon: block.callout?.icon || undefined,
            };
        case 'divider':
            return baseBlock;
        case 'table':
            return {
                ...baseBlock,
                table_width: block.table?.table_width,
                has_column_header: block.table?.has_column_header,
                has_row_header: block.table?.has_row_header,
            };
        case 'image':
            return {
                ...baseBlock,
                caption: block.image?.caption?.map((t: any) => t.plain_text).join('') || '',
                file: block.image?.file?.url || undefined,
                external: block.image?.external?.url || undefined,
            };
        case 'video':
            return {
                ...baseBlock,
                caption: block.video?.caption?.map((t: any) => t.plain_text).join('') || '',
                file: block.video?.file?.url || undefined,
                external: block.video?.external?.url || undefined,
            };
        case 'file':
            return {
                ...baseBlock,
                caption: block.file?.caption?.map((t: any) => t.plain_text).join('') || '',
                file: block.file?.file?.url || undefined,
                external: block.file?.external?.url || undefined,
            };
        case 'bookmark':
            return {
                ...baseBlock,
                url: block.bookmark?.url || '',
                caption: block.bookmark?.caption?.map((t: any) => t.plain_text).join('') || '',
            };
        case 'link_preview':
            return {
                ...baseBlock,
                url: block.link_preview?.url || '',
            };
        case 'link_to_page':
            return {
                ...baseBlock,
                page_id: block.link_to_page?.page_id || undefined,
                database_id: block.link_to_page?.database_id || undefined,
            };
        default:
            return baseBlock;
    }
}

// Helper function to recursively fetch all blocks including children
async function fetchAllBlocks(notion: Client, blockId: string): Promise<any[]> {
    const allBlocks: any[] = [];
    let cursor: string | undefined = undefined;

    do {
        const response = await notion.blocks.children.list({
            block_id: blockId,
            start_cursor: cursor,
        });

        for (const block of response.results) {
            const processedBlock = extractBlockContent(block);
            
            // Recursively fetch children if they exist
            // Type guard to check if block has has_children property
            if ('has_children' in block && block.has_children && 'type' in block && block.type !== 'child_page') {
                processedBlock.children = await fetchAllBlocks(notion, block.id);
            }
            
            allBlocks.push(processedBlock);
        }

        cursor = response.next_cursor || undefined;
    } while (cursor);

    return allBlocks;
}

const notionQueryPageTool = tool({
    name: 'notion_query_page',
    description: `ALWAYS CALL THIS FIRST. DO NOT MODIFY ANYTHING WITHOUT CALLING THIS FIRST.

This tool returns the current state of the page including all properties, metadata, and content blocks.`,
    parameters: z.object({
        // No parameters needed - returns complete page information
    }),
    execute: async ({ }, runContext?: RunContext<NotionPageSession>) => {
        console.log("Executing notion_query_page tool");
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        const pageId = runContext.context.notionPageConfig.page_id as string;

        // Fetch page metadata
        const pageInfo: GetPageResponse = await notion.pages.retrieve({
            page_id: pageId,
        });

        // Type guard to check if it's a full page response (not partial)
        const isFullPage = (page: GetPageResponse): page is PageObjectResponse => {
            return 'properties' in page;
        };

        // Extract readable property values
        const properties: Record<string, any> = {};
        if (isFullPage(pageInfo) && pageInfo.properties) {
            for (const [key, value] of Object.entries(pageInfo.properties)) {
                properties[key] = extractPropertyValue(value);
            }
        }

        // Fetch all blocks/content from the page
        let blocks: any[] = [];
        try {
            blocks = await fetchAllBlocks(notion, pageId);
        } catch (error: any) {
            console.warn("Error fetching blocks:", error.message);
            // Continue even if blocks fail to fetch
        }

        // Extract comprehensive metadata
        const metadata: any = {
            page_id: pageInfo.id,
            object: pageInfo.object,
        };

        // Only include properties that exist in the response
        if (isFullPage(pageInfo)) {
            metadata.url = pageInfo.url;
            metadata.public_url = 'public_url' in pageInfo ? (pageInfo as any).public_url : undefined;
            metadata.created_time = pageInfo.created_time;
            metadata.last_edited_time = pageInfo.last_edited_time;
            metadata.archived = 'archived' in pageInfo ? pageInfo.archived : undefined;
            metadata.icon = 'icon' in pageInfo ? pageInfo.icon : undefined;
            metadata.cover = 'cover' in pageInfo ? pageInfo.cover : undefined;
            metadata.parent = 'parent' in pageInfo ? pageInfo.parent : undefined;
            metadata.created_by = 'created_by' in pageInfo ? {
                id: (pageInfo as any).created_by?.id,
                name: (pageInfo as any).created_by?.name || undefined,
                object: (pageInfo as any).created_by?.object
            } : undefined;
            metadata.last_edited_by = 'last_edited_by' in pageInfo ? {
                id: (pageInfo as any).last_edited_by?.id,
                name: (pageInfo as any).last_edited_by?.name || undefined,
                object: (pageInfo as any).last_edited_by?.object
            } : undefined;
            metadata.in_trash = 'in_trash' in pageInfo ? (pageInfo as any).in_trash : undefined;
        }

        return {
            ...metadata,
            properties: properties,
            properties_raw: isFullPage(pageInfo) ? pageInfo.properties : undefined, // Include raw properties for reference
            blocks: blocks,
            blocks_count: blocks.length,
        };
    }
});

// Tool 2: Modify (create or update) pages in the Notion page
const notionModifyPageTool = tool({
    name: 'notion_modify_page',
    description: `Modify the current state of the page.`,
    parameters: z.object({
        properties_json: z.string().describe('JSON string with property names as keys and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'),
    }),
    execute: async ({ properties_json }, runContext?: RunContext<NotionPageSession>) => {
        console.log(chalk.bgMagenta.white.bold('🛠️ Executing notion_modify_page tool'));
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

        // Use the page_id from the context for updates
        const pageId = runContext.context.notionPageConfig.page_id as string;

        try {
            // Update existing page
            const response = await notion.pages.update({
                page_id: pageId,
                properties: properties as Record<string, any>,
            });
            // Report action (no DB writes here)
            runContext.context.runActions = runContext.context.runActions || [];
            runContext.context.runActions.push({
                action: 'update_page',
                integration: 'notion',
                target: runContext.context.notionPageConfig.page_name || runContext.context.notionPageConfig.page_id,
                details: 'Notion page updated',
                url: 'url' in response ? (response as any).url : undefined,
            });
            return {
                success: true,
                action: 'updated',
                page_id: response.id,
                url: 'url' in response ? response.url : undefined
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                hint: 'Check that property names match the page schema and values are in correct Notion API format'
            };
        }
    }
});