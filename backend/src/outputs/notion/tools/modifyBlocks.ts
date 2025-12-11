import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { Client } from '@notionhq/client';
import chalk from "chalk";
import { IntegrationType } from "../../../shared/Integrations";
import { NotionPageSession } from "../NotionPageOutput";
import { getBlockTypeName, describeBlocks } from "../../../utility/notion";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";

export const notionModifyBlocksTool = tool({
    name: 'notion_modify_blocks',
    description: `Add, update, or delete a block in the page content. Use this to modify page content (paragraphs, headings, lists, etc.). Call this tool once per operation - for multiple changes, call multiple times.

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
        operation_json: z.string().describe(`JSON string with a single operation object containing:
- operation: "append" | "update" | "delete"
- For append: blocks (array of block objects) and optional parent_block_id
- For update: block_id and block (block object with the type-specific properties)
- For delete: block_id

Example append: "{\"operation\": \"append\", \"blocks\": [{\"object\": \"block\", \"type\": \"paragraph\", \"paragraph\": {\"rich_text\": [{\"type\": \"text\", \"text\": {\"content\": \"New content\"}}]}}]}"
Example update: "{\"operation\": \"update\", \"block_id\": \"abc123\", \"block\": {\"paragraph\": {\"rich_text\": [{\"type\": \"text\", \"text\": {\"content\": \"Updated\"}}]}}}"
Example delete: "{\"operation\": \"delete\", \"block_id\": \"abc123\"}"`),
    }),
    execute: async ({ operation_json }, runContext?: RunContext<SessionWithTracking<NotionPageSession>>) => {
        console.log(chalk.bgMagenta.white.bold('🛠️ Executing notion_modify_blocks tool'));
        console.log(chalk.cyan('  Operation JSON: '), chalk.greenBright(operation_json));
        
        // Parse the JSON string
        let op: {
            operation: 'append' | 'update' | 'delete';
            blocks?: any[];
            parent_block_id?: string;
            block_id?: string;
            block?: any;
        };
        try {
            op = JSON.parse(operation_json);
            if (Array.isArray(op)) {
                return {
                    success: false,
                    error: 'operation_json must be a single operation object, not an array',
                    hint: 'Call this tool once per operation. For multiple changes, call the tool multiple times.'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: 'Invalid JSON in operation_json parameter',
                hint: 'Ensure operation_json is a valid JSON string object'
            };
        }

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        const pageId = runContext.context.notionPageConfig.page_id as string;

        try {
            if (op.operation === 'append') {
                if (!op.blocks || !Array.isArray(op.blocks) || op.blocks.length === 0) {
                    return {
                        success: false,
                        error: 'blocks array is required and must not be empty'
                    };
                }

                const targetId = op.parent_block_id || pageId;
                const response = await notion.blocks.children.append({
                    block_id: targetId,
                    children: op.blocks,
                });

                // Report action
                const blockDescription = describeBlocks(op.blocks);
                const pageName = runContext.context.notionPageConfig.page_name || 'Notion page';
                runContext.context.trackAction({
                    action: 'Added content',
                    integration: IntegrationType.NOTION,
                    target: pageName,
                    details: `Added ${response.results.length} ${response.results.length === 1 ? 'item' : 'items'}: ${blockDescription}`,
                    type: 'create',
                });

                return {
                    success: true,
                    operation: 'append',
                    block_ids: response.results.map((b: any) => b.id),
                    blocks_count: response.results.length,
                };
            } else if (op.operation === 'update') {
                if (!op.block_id) {
                    return {
                        success: false,
                        error: 'block_id is required for update operation'
                    };
                }

                if (!op.block || typeof op.block !== 'object') {
                    return {
                        success: false,
                        error: 'block object is required for update operation'
                    };
                }

                const response = await notion.blocks.update({
                    block_id: op.block_id,
                    ...op.block,
                });

                // Report action
                const pageName = runContext.context.notionPageConfig.page_name || 'Notion page';
                const blockType = getBlockTypeName(op.block);
                runContext.context.trackAction({
                    action: 'Updated content',
                    integration: IntegrationType.NOTION,
                    target: pageName,
                    details: `Updated ${blockType}`,
                    type: 'update',
                });

                return {
                    success: true,
                    operation: 'update',
                    block_id: response.id,
                };
            } else if (op.operation === 'delete') {
                if (!op.block_id) {
                    return {
                        success: false,
                        error: 'block_id is required for delete operation'
                    };
                }

                // Delete by archiving
                const response = await notion.blocks.update({
                    block_id: op.block_id,
                    archived: true,
                });

                // Report action
                const pageName = runContext.context.notionPageConfig.page_name || 'Notion page';
                runContext.context.trackAction({
                    action: 'Removed content',
                    integration: IntegrationType.NOTION,
                    target: pageName,
                    details: 'Removed content block',
                    type: 'delete',
                });

                return {
                    success: true,
                    operation: 'delete',
                    block_id: response.id,
                };
            } else {
                return {
                    success: false,
                    error: `Unknown operation: ${op.operation}. Must be 'append', 'update', or 'delete'`
                };
            }
        } catch (error: any) {
            return {
                success: false,
                operation: op.operation,
                error: error.message,
                hint: 'Check that block structure matches Notion API format and block_id is valid'
            };
        }
    }
});

