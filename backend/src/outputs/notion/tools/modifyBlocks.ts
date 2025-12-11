import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { Client } from '@notionhq/client';
import chalk from "chalk";
import { IntegrationType } from "../../../shared/Integrations";
import { NotionPageSession } from "../NotionPageOutput";
import { getBlockTypeName, describeBlocks } from "../../../utility/notion";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { formatError } from "../../../tools/errors";

/**
 * Constructs a Notion deep link URL to a specific block.
 * Strips hyphens from the block ID as required by Notion's URL format.
 */
function getBlockDeepLinkUrl(pageUrl: string | undefined, blockId: string | undefined): string | undefined {
    if (!pageUrl || !blockId) {
        return undefined;
    }
    // Notion block IDs in URLs must have hyphens removed
    const blockIdWithoutHyphens = blockId.replace(/-/g, '');
    return `${pageUrl}?source=copy_link#${blockIdWithoutHyphens}`;
}

export const notionModifyBlocksTool = tool({
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
    execute: async ({ operations_json }, runContext?: RunContext<SessionWithTracking<NotionPageSession>>) => {
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
        
        // Fetch page URL once for constructing block deep links
        let pageUrl: string | undefined;
        try {
            const pageResponse = await notion.pages.retrieve({ page_id: pageId });
            pageUrl = 'url' in pageResponse ? pageResponse.url : undefined;
        } catch (error) {
            // If we can't fetch the page URL, we'll just skip adding URLs to trackAction
            console.warn('Could not fetch page URL for deep linking:', error);
        }

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
                    const blockDescription = describeBlocks(op.blocks);
                    const pageName = runContext.context.notionPageConfig.page_name || 'Notion page';
                    // Use first block ID for deep linking (if multiple blocks, link to first one)
                    const firstBlockId = response.results.length > 0 ? response.results[0].id : undefined;
                    const blockUrl = getBlockDeepLinkUrl(pageUrl, firstBlockId);
                    runContext.context.trackAction({
                        action: 'Added content',
                        integration: IntegrationType.NOTION,
                        target: pageName,
                        details: `Added ${response.results.length} ${response.results.length === 1 ? 'item' : 'items'}: ${blockDescription}`,
                        type: 'create',
                        url: blockUrl,
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
                    const pageName = runContext.context.notionPageConfig.page_name || 'Notion page';
                    const blockType = getBlockTypeName(op.block);
                    const blockUrl = getBlockDeepLinkUrl(pageUrl, response.id);
                    runContext.context.trackAction({
                        action: 'Updated content',
                        integration: IntegrationType.NOTION,
                        target: pageName,
                        details: `Updated ${blockType}`,
                        type: 'update',
                        url: blockUrl,
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
                    const pageName = runContext.context.notionPageConfig.page_name || 'Notion page';
                    const blockUrl = getBlockDeepLinkUrl(pageUrl, response.id);
                    runContext.context.trackAction({
                        action: 'Removed content',
                        integration: IntegrationType.NOTION,
                        target: pageName,
                        details: 'Removed content block',
                        type: 'delete',
                        url: blockUrl,
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
    },
    errorFunction: formatError
});

