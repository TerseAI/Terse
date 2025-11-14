import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { RunContext, Tool, tool } from "@openai/agents";
import { AutomationNotionPageConfig, AutomationOutput, NotionIntegration, User } from "../../types/prisma";
import { Session } from "../../server";
import { Client } from '@notionhq/client';
import { z } from "zod";
import { Output, OutputType, ToolboxEntry } from "./Output";
import { db } from "../../prismaClient";
import chalk from "chalk";
import { GetPageResponse, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export interface NotionPageSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionPageConfig: AutomationNotionPageConfig; // Configuration for the Specific Notion Page
    // Collect actions here (report-only); DB writes happen after agent finishes
    runActions?: RunHistoryAction[];
}

export class NotionPageOutput extends Output<NotionPageSession> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionQueryPageTool as Tool, isReadOnly: true },
            { tool: notionModifyBlocksTool as Tool, isReadOnly: false },
        ];
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
    description: `Call this tool ONCE at the beginning of your run to get the page state. After calling it once, remember and reuse the results - DO NOT call it multiple times in the same run.

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

// Tool 3: Modify blocks (add, update, delete) in the Notion page
const notionModifyBlocksTool = tool({
    name: 'notion_modify_blocks',
    description: `Add, update, or delete blocks in the page content. Use this to modify the page content (paragraphs, headings, lists, etc.). 
    
Operations:
- append: Add new blocks to the page (or to a parent block if parent_block_id is provided)
- update: Update an existing block by block_id
- delete: Delete (archive) a block by block_id

Examples:
- Append paragraph: {"operation": "append", "blocks": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Hello world"}}]}}]}
- Append heading: {"operation": "append", "blocks": [{"object": "block", "type": "heading_1", "heading_1": {"rich_text": [{"type": "text", "text": {"content": "Title"}}]}}]}
- Update block: {"operation": "update", "block_id": "abc123", "block": {"paragraph": {"rich_text": [{"type": "text", "text": {"content": "Updated text"}}]}}}
- Delete block: {"operation": "delete", "block_id": "abc123"}`,
    parameters: z.object({
        operations_json: z.string().describe(`JSON string with an array of operations. Each operation should have:
- operation: "append" | "update" | "delete"
- For append: blocks (array of block objects) and optional parent_block_id
- For update: block_id and block (block object with the type-specific properties)
- For delete: block_id

Example: "[{\"operation\": \"append\", \"blocks\": [{\"object\": \"block\", \"type\": \"paragraph\", \"paragraph\": {\"rich_text\": [{\"type\": \"text\", \"text\": {\"content\": \"New content\"}}]}}]}]"`),
    }),
    execute: async ({ operations_json }, runContext?: RunContext<NotionPageSession>) => {
        console.log(chalk.bgMagenta.white.bold('🛠️ Executing notion_modify_blocks tool'));
        console.log(chalk.cyan('  Operations JSON: '), chalk.greenBright(operations_json));

        // Parse the JSON string
        let operations: Array<{
            operation: 'append' | 'update' | 'delete';
            blocks?: any[];
            parent_block_id?: string;
            block_id?: string;
            block?: any;
        }>;
        try {
            operations = JSON.parse(operations_json);
            if (!Array.isArray(operations)) {
                return {
                    success: false,
                    error: 'operations_json must be an array',
                    hint: 'Ensure operations_json is a JSON array of operations'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: 'Invalid JSON in operations_json parameter',
                hint: 'Ensure operations_json is a valid JSON string array'
            };
        }

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        const pageId = runContext.context.notionPageConfig.page_id as string;
        const results: any[] = [];
        let hasErrors = false;

        for (const op of operations) {
            try {
                if (op.operation === 'append') {
                    if (!op.blocks || !Array.isArray(op.blocks) || op.blocks.length === 0) {
                        results.push({
                            operation: 'append',
                            success: false,
                            error: 'blocks array is required and must not be empty'
                        });
                        hasErrors = true;
                        continue;
                    }

                    const targetId = op.parent_block_id || pageId;
                    const response = await notion.blocks.children.append({
                        block_id: targetId,
                        children: op.blocks,
                    });

                    results.push({
                        operation: 'append',
                        success: true,
                        block_ids: response.results.map((b: any) => b.id),
                        blocks_count: response.results.length,
                    });

                    // Report action
                    runContext.context.runActions = runContext.context.runActions || [];
                    runContext.context.runActions.push({
                        action: 'append_blocks',
                        integration: 'notion',
                        target: runContext.context.notionPageConfig.page_id || runContext.context.notionPageConfig.page_name,
                        details: `Added ${response.results.length} block(s)`,
                    });
                } else if (op.operation === 'update') {
                    if (!op.block_id) {
                        results.push({
                            operation: 'update',
                            success: false,
                            error: 'block_id is required for update operation'
                        });
                        hasErrors = true;
                        continue;
                    }

                    if (!op.block || typeof op.block !== 'object') {
                        results.push({
                            operation: 'update',
                            success: false,
                            error: 'block object is required for update operation'
                        });
                        hasErrors = true;
                        continue;
                    }

                    const response = await notion.blocks.update({
                        block_id: op.block_id,
                        ...op.block,
                    });

                    results.push({
                        operation: 'update',
                        success: true,
                        block_id: response.id,
                    });

                    // Report action
                    runContext.context.runActions = runContext.context.runActions || [];
                    runContext.context.runActions.push({
                        action: 'update_block',
                        integration: 'notion',
                        target: runContext.context.notionPageConfig.page_id ||  runContext.context.notionPageConfig.page_name,
                        details: 'Block updated',
                    });
                } else if (op.operation === 'delete') {
                    if (!op.block_id) {
                        results.push({
                            operation: 'delete',
                            success: false,
                            error: 'block_id is required for delete operation'
                        });
                        hasErrors = true;
                        continue;
                    }

                    // Delete by archiving
                    const response = await notion.blocks.update({
                        block_id: op.block_id,
                        archived: true,
                    });

                    results.push({
                        operation: 'delete',
                        success: true,
                        block_id: response.id,
                    });

                    // Report action
                    runContext.context.runActions = runContext.context.runActions || [];
                    runContext.context.runActions.push({
                        action: 'delete_block',
                        integration: 'notion',
                        target: runContext.context.notionPageConfig.page_id || runContext.context.notionPageConfig.page_name,
                        details: 'Block deleted',
                    });
                } else {
                    results.push({
                        operation: op.operation,
                        success: false,
                        error: `Unknown operation: ${op.operation}. Must be 'append', 'update', or 'delete'`
                    });
                    hasErrors = true;
                }
            } catch (error: any) {
                results.push({
                    operation: op.operation,
                    success: false,
                    error: error.message,
                    hint: 'Check that block structure matches Notion API format and block_id is valid'
                });
                hasErrors = true;
            }
        }

        return {
            success: !hasErrors,
            results: results,
            operations_count: operations.length,
            successful_count: results.filter((r: any) => r.success).length,
            failed_count: results.filter((r: any) => !r.success).length,
        };
    }
});