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
    description: `Add, update, or delete blocks in page content. Use this to modify page content (paragraphs, headings, lists, etc.).

Accepts a single operation object (backwards compatible) OR an array of operation objects executed sequentially. One approval covers the whole batch.

Operations:
- append: Add new blocks to the page (or to a parent block if parent_block_id is provided). Use optional after_block_id to insert after a specific block instead of at the end. Get block IDs from notion_query_page.
- update: Update an existing block by block_id
- delete: Delete (archive) a block by block_id

Positional insertion: Use after_block_id with append to insert blocks after a specific block instead of at the end.

Moving blocks within a page:
1. Retrieve the block content with notion_query_page.
2. Append the block at the desired position (use after_block_id for position, or parent_block_id for container).
3. Delete the original block with the "delete" operation.

Examples — single operation:
- Append: {"operation": "append", "blocks": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Hello world"}}]}}]}
- Append after a block: {"operation": "append", "after_block_id": "xyz789", "blocks": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Inserted here"}}]}}]}
- Update: {"operation": "update", "block_id": "abc123", "block": {"paragraph": {"rich_text": [{"type": "text", "text": {"content": "Updated text"}}]}}}
- Delete: {"operation": "delete", "block_id": "abc123"}

Examples — batch (array):
[{"operation": "append", "blocks": [...]}, {"operation": "update", "block_id": "abc", "block": {...}}, {"operation": "delete", "block_id": "def"}]`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        pageId: z.string().describe("The Notion page ID to modify."),
        operation_json: z.string().describe(`JSON string: a single operation object OR an array of operation objects (executed in order).
Each operation: operation ("append"|"update"|"delete"); for append: blocks (array), optional parent_block_id, optional after_block_id; for update: block_id, block; for delete: block_id.
Append with after_block_id inserts after that block; omit for end of page/parent.`)
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.NOTION_MODIFY_BLOCKS),
    execute: async ({ integrationId, pageId, operation_json }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        type Op = {
            operation: "append" | "update" | "delete"
            blocks?: any[]
            parent_block_id?: string
            after_block_id?: string
            block_id?: string
            block?: any
        }
        let parsed: Op | Op[]
        try {
            parsed = JSON.parse(operation_json)
            if (typeof parsed !== "object" || parsed === null) {
                throw new Error("operation_json must be an object or array of objects")
            }
        } catch (error) {
            throw new Error("Invalid JSON in operation_json parameter. Ensure operation_json is a valid JSON string")
        }

        const ops: Op[] = Array.isArray(parsed) ? parsed : [parsed]

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

        const results: any[] = []
        const allActions: any[] = []
        const allBlockIds: string[] = []
        let failedAtIndex: number | undefined

        for (let i = 0; i < ops.length; i++) {
            const op = ops[i]
            try {
                if (op.operation === "append") {
                    if (!op.blocks || !Array.isArray(op.blocks) || op.blocks.length === 0) {
                        return {
                            success: false,
                            ...(ops.length === 1 ? {} : { failed_at_index: i, operations: results }),
                            error: "blocks array is required and must not be empty",
                            operations: results,
                            actions: allActions,
                            block_ids: allBlockIds
                        }
                    }

                    logger.info("Appending blocks to target block", {
                        parent_block_id: op.parent_block_id,
                        after_block_id: op.after_block_id,
                        pageId,
                        blocks: op.blocks.length
                    })

                    const targetId = op.parent_block_id || pageId
                    const appendParams: { block_id: string; children: any[]; after?: string } = {
                        block_id: targetId,
                        children: op.blocks
                    }
                    if (op.after_block_id) {
                        appendParams.after = op.after_block_id
                    }
                    const response = await notion.blocks.children.append(appendParams)

                    const blockDescription = describeBlocks(op.blocks)
                    const blockIds = response.results.map((b: any) => b.id)
                    const action = {
                        action: "Added content",
                        integration: IntegrationType.NOTION,
                        target: pageName,
                        details: `Added ${response.results.length} ${response.results.length === 1 ? "item" : "items"}: ${blockDescription}`,
                        url: pageUrl,
                        type: "create",
                        output_items: blockIds.map((blockId: string) => ({
                            output_item_id: blockId,
                            output_item_type: ConfigType.NOTION
                        }))
                    }

                    results.push({
                        operation: "append",
                        actions: [action],
                        block_ids: blockIds,
                        blocks_count: response.results.length
                    })
                    allActions.push(action)
                    allBlockIds.push(...blockIds)
                } else if (op.operation === "update") {
                    if (!op.block_id) {
                        return {
                            success: false,
                            ...(ops.length === 1 ? {} : { failed_at_index: i, operations: results }),
                            error: "block_id is required for update operation",
                            operations: results,
                            actions: allActions,
                            block_ids: allBlockIds
                        }
                    }
                    if (!op.block || typeof op.block !== "object") {
                        return {
                            success: false,
                            ...(ops.length === 1 ? {} : { failed_at_index: i, operations: results }),
                            error: "block object is required for update operation",
                            operations: results,
                            actions: allActions,
                            block_ids: allBlockIds
                        }
                    }

                    logger.info("Updating block", { block_id: op.block_id, block: op.block })

                    const response = await notion.blocks.update({
                        block_id: op.block_id,
                        ...op.block
                    })

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
                                output_item_type: ConfigType.NOTION
                            }
                        ]
                    }

                    results.push({
                        operation: "update",
                        actions: [action],
                        block_id: response.id
                    })
                    allActions.push(action)
                    allBlockIds.push(response.id)
                } else if (op.operation === "delete") {
                    if (!op.block_id) {
                        return {
                            success: false,
                            ...(ops.length === 1 ? {} : { failed_at_index: i, operations: results }),
                            error: "block_id is required for delete operation",
                            operations: results,
                            actions: allActions,
                            block_ids: allBlockIds
                        }
                    }

                    logger.info("Deleting block", { block_id: op.block_id })

                    const response = await notion.blocks.update({
                        block_id: op.block_id,
                        archived: true
                    })

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
                                output_item_type: ConfigType.NOTION
                            }
                        ]
                    }

                    results.push({
                        operation: "delete",
                        actions: [action],
                        block_id: response.id
                    })
                    allActions.push(action)
                    allBlockIds.push(response.id)
                } else {
                    return {
                        success: false,
                        ...(ops.length === 1 ? {} : { failed_at_index: i, operations: results }),
                        error: `Unknown operation: ${(op as any).operation}. Must be 'append', 'update', or 'delete'`,
                        operations: results,
                        actions: allActions,
                        block_ids: allBlockIds
                    }
                }
            } catch (error: any) {
                failedAtIndex = i
                return {
                    success: false,
                    failed_at_index: i,
                    operations: results,
                    actions: allActions,
                    block_ids: allBlockIds,
                    total_operations: ops.length,
                    error: error.message,
                    hint: "Check that block structure matches Notion API format and block_id is valid"
                }
            }
        }

        // All operations succeeded
        if (ops.length === 1) {
            const r = results[0]
            return {
                success: true,
                operation: r.operation,
                actions: r.actions,
                ...(r.block_ids ? { block_ids: r.block_ids, blocks_count: r.blocks_count } : { block_id: r.block_id })
            }
        }
        return {
            success: true,
            operations: results,
            actions: allActions,
            block_ids: allBlockIds,
            total_operations: ops.length
        }
    }
})
