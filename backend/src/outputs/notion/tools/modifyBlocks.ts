import { Client } from "@notionhq/client"
import { RunContext, tool } from "@openai/agents"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { NotionIntegrationManager } from "../../../integrations/NotionIntegration"
import logger from "../../../logger"
import { ConfigType } from "../../../shared/Configs"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"
import { describeBlocks, extractPageTitle, getBlockTypeName } from "../../../utility/notion"

/**
 * Constructs a Notion deep link URL to a specific block.
 * Strips hyphens from the block ID as required by Notion's URL format.
 */
function getBlockDeepLinkUrl(pageUrl: string | undefined, blockId: string | undefined): string | undefined {
    if (!pageUrl || !blockId) {
        return undefined
    }
    // Notion block IDs in URLs must have hyphens removed
    const blockIdWithoutHyphens = blockId.replace(/-/g, "")
    return `${pageUrl}?source=copy_link#${blockIdWithoutHyphens}`
}

export const notionModifyBlocksTool = tool({
    name: ToolName.NOTION_MODIFY_BLOCKS,
    description: `Add, update, or delete a block in the page content. Use this to modify page content (paragraphs, headings, lists, etc.). Call this tool once per operation - for multiple changes, call multiple times.

Operations:
- append: Add new blocks to the page (or to a parent block if parent_block_id is provided)
- update: Update an existing block by block_id
- delete: Delete (archive) a block by block_id

Moving blocks within a page:
To move a block to a different position on the page, you need to:
1. First, retrieve the block content you want to move (using the notion_query_page tool)
2. Create a new block with the same content using the "append" operation at the desired position (specify parent_block_id if moving within a parent block)
3. Delete the original block using the "delete" operation with its block_id

This two-step process (copy + append, then delete) is necessary because the Notion API doesn't support direct block movement.

Examples:
- Append paragraph: {"operation": "append", "blocks": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Hello world"}}]}}]}
- Append heading: {"operation": "append", "blocks": [{"object": "block", "type": "heading_1", "heading_1": {"rich_text": [{"type": "text", "text": {"content": "Title"}}]}}]}
- Update block: {"operation": "update", "block_id": "abc123", "block": {"paragraph": {"rich_text": [{"type": "text", "text": {"content": "Updated text"}}]}}}
- Delete block: {"operation": "delete", "block_id": "abc123"}
- Move block: First append the block at new position, then delete the original block_id`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        pageId: z.string().describe("The Notion page ID to modify."),
        operation_json: z.string().describe(`JSON string with a single operation object containing:
- operation: "append" | "update" | "delete"
- For append: blocks (array of block objects) and optional parent_block_id
- For update: block_id and block (block object with the type-specific properties)
- For delete: block_id

Example append: "{\"operation\": \"append\", \"blocks\": [{\"object\": \"block\", \"type\": \"paragraph\", \"paragraph\": {\"rich_text\": [{\"type\": \"text\", \"text\": {\"content\": \"New content\"}}]}}]}"
Example update: "{\"operation\": \"update\", \"block_id\": \"abc123\", \"block\": {\"paragraph\": {\"rich_text\": [{\"type\": \"text\", \"text\": {\"content\": \"Updated\"}}]}}}"
Example delete: "{\"operation\": \"delete\", \"block_id\": \"abc123\"}"`)
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.NOTION_MODIFY_BLOCKS),
    execute: async ({ integrationId, pageId, operation_json }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        // Parse the JSON string
        let op: {
            operation: "append" | "update" | "delete"
            blocks?: any[]
            parent_block_id?: string
            block_id?: string
            block?: any
        }
        try {
            op = JSON.parse(operation_json)
            if (Array.isArray(op)) {
                logger.error("operation_json is an array, not a single operation object. Not continuing")
                return {
                    success: false,
                    error: "operation_json must be a single operation object, not an array",
                    hint: "Call this tool once per operation. For multiple changes, call the tool multiple times."
                }
            }
        } catch (error) {
            throw new Error("Invalid JSON in operation_json parameter. Ensure operation_json is a valid JSON string")
        }

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new NotionIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Notion integration not found or access denied for integrationId: ${integrationId}`)
        }

        const notion = new Client({
            auth: accessToken
        })

        const pageInfo = await notion.pages.retrieve({
            page_id: pageId
        })
        const pageName = extractPageTitle(pageInfo)
        const pageUrl = "url" in pageInfo ? pageInfo.url : undefined

        try {
            if (op.operation === "append") {
                if (!op.blocks || !Array.isArray(op.blocks) || op.blocks.length === 0) {
                    return {
                        success: false,
                        error: "blocks array is required and must not be empty"
                    }
                }

                logger.info("Appending blocks to target block", { parent_block_id: op.parent_block_id, pageId, blocks: op.blocks.length })

                const targetId = op.parent_block_id || pageId
                const response = await notion.blocks.children.append({
                    block_id: targetId,
                    children: op.blocks
                })

                // Return action as part of the result
                const blockDescription = describeBlocks(op.blocks)
                const blockIds = response.results.map((b: any) => b.id)
                const action = {
                    action: "Added content",
                    integration: IntegrationType.NOTION,
                    target: pageName,
                    details: `Added ${response.results.length} ${response.results.length === 1 ? "item" : "items"}: ${blockDescription}`,
                    url: pageUrl,
                    type: "create",
                    output_items: blockIds.map(blockId => ({
                        output_item_id: blockId,
                        output_item_type: ConfigType.NOTION_PAGE
                    }))
                }

                return {
                    success: true,
                    operation: "append",
                    actions: [action],
                    block_ids: response.results.map((b: any) => b.id),
                    blocks_count: response.results.length
                }
            } else if (op.operation === "update") {
                if (!op.block_id) {
                    return {
                        success: false,
                        error: "block_id is required for update operation"
                    }
                }

                if (!op.block || typeof op.block !== "object") {
                    return {
                        success: false,
                        error: "block object is required for update operation"
                    }
                }

                logger.info("Updating block", { block_id: op.block_id, block: op.block })

                const response = await notion.blocks.update({
                    block_id: op.block_id,
                    ...op.block
                })

                // Return action as part of the result
                const blockType = getBlockTypeName(op.block)
                const action = {
                    action: "Updated content",
                    integration: IntegrationType.NOTION,
                    target: pageName,
                    details: `Updated ${blockType}`,
                    type: "update",
                    url: pageUrl,
                    output_items: [
                        {
                            output_item_id: response.id,
                            output_item_type: ConfigType.NOTION_PAGE
                        }
                    ]
                }

                return {
                    success: true,
                    operation: "update",
                    actions: [action],
                    block_id: response.id
                }
            } else if (op.operation === "delete") {
                if (!op.block_id) {
                    return {
                        success: false,
                        error: "block_id is required for delete operation"
                    }
                }

                logger.info("Deleting block", { block_id: op.block_id })

                // Delete by archiving
                const response = await notion.blocks.update({
                    block_id: op.block_id,
                    archived: true
                })

                // Return action as part of the result
                const action = {
                    action: "Removed content",
                    integration: IntegrationType.NOTION,
                    target: pageName,
                    details: "Removed content block",
                    type: "delete",
                    url: pageUrl,
                    output_items: [
                        {
                            output_item_id: response.id,
                            output_item_type: ConfigType.NOTION_PAGE
                        }
                    ]
                }

                return {
                    success: true,
                    operation: "delete",
                    actions: [action],
                    block_id: response.id
                }
            } else {
                return {
                    success: false,
                    error: `Unknown operation: ${op.operation}. Must be 'append', 'update', or 'delete'`
                }
            }
        } catch (error: any) {
            return {
                success: false,
                operation: op.operation,
                error: error.message,
                hint: "Check that block structure matches Notion API format and block_id is valid"
            }
        }
    }
})
