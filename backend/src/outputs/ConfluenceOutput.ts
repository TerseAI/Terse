import { RunContext, Tool, tool } from "@openai/agents"
import { OutputConfigType, RunHistoryActionType } from "@prisma/client"
import chalk from "chalk"
import { z } from "zod"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import { buildDummyOutputConfig } from "../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../capabilityHelpers"
import { AtlassianClient } from "../integrations/AtlassianClient"
import { validateConfluencePageExists } from "../integrations/AtlassianIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { ConfluenceConfig } from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"
import { ToolName } from "../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../tools/toolUtils"
import { AgentOutputWithConfigs, PrismaTransaction } from "../types/prisma"
import { Session } from "../types/session"
import { ConfluenceConfigSchema, stripConfigForValidation } from "../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../utility/typeConverters"

import { Output, ToolboxEntry } from "./abstract/Output"

// MARK: - Exports

export class ConfluenceOutput extends Output<ConfluenceConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: confluenceQueryPageTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.ATLASSIAN,
                displayName: "Query page"
            },
            {
                tool: confluenceAddCommentTool as Tool,
                isReadOnly: false,
                integration: IntegrationType.ATLASSIAN,
                displayName: "Add comment"
            }
        ]
        super(OutputConfigType.CONFLUENCE, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.CONFLUENCE)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "Atlassian/Confluence integration connection",
                spaceName: "Confluence space name",
                spaceId: "Confluence space ID",
                pageId: "Confluence page ID to update",
                pageName: "Page display name"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.CONFLUENCE,
            confluence_config: {
                space_name: "Example Space",
                space_id: "123",
                page_id: "456",
                page_name: "Example Page"
            }
        })
    }

    async validateConfig(output: ConfluenceConfig, _userId: string): Promise<void> {
        // Not doing schema validation here because
        // it errors out. TODO: fix this.
        await validateConfluencePageExists(output.integrationId, output.pageId)
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: ConfluenceConfig): Promise<void> {
        await tx.automation_confluence_configs.create({
            data: {
                automation_output_id: agentOutputId,
                space_name: output.spaceName ?? "",
                space_id: output.spaceId ?? "",
                page_id: output.pageId,
                page_name: output.pageName
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Confluence configs provided")
        }

        const sections: string[] = []
        sections.push("=== CONFLUENCE OUTPUT ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            if (!config.confluence_config) {
                throw new Error("Confluence config not found")
            }
            const pageId = config.confluence_config.page_id
            const pageName = config.confluence_config.page_name
            configList.push(`  • Integration ID: ${config.integration_id} - Page Name: ${pageName || "N/A"}, Page ID: ${pageId || "N/A"}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Confluence tools, you MUST include the `integrationId` and `pageId` parameters matching one of the configurations listed above.")

        return sections.join("\n")
    }
}

// MARK: - Tools

const confluenceQueryPageTool = tool({
    name: ToolName.CONFLUENCE_QUERY_PAGE,
    description: `ALWAYS CALL THIS FIRST. DO NOT MODIFY ANYTHING WITHOUT CALLING THIS FIRST.

This tool returns the current state of the Confluence page including all metadata, properties, and content body.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Atlassian/Confluence integration to use."),
        pageId: z.string().describe("The Confluence page ID to query.")
    }),
    execute: async ({ integrationId, pageId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing confluence_query_page tool")
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const user = runContext.context.user
        const manager = new AtlassianClient()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Atlassian integration not found or access denied for integrationId: ${integrationId}`)
        }

        // Ensure the integration belongs to the user's organization
        const integration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId, organization_id: user.organizationId },
            select: { cloud_id: true, base_url: true }
        })

        if (!integration || !integration.cloud_id) {
            throw new Error(`Atlassian integration not found, not in your organization, or missing cloud ID for integrationId: ${integrationId}`)
        }

        if (!integration.base_url) {
            throw new Error(`No base_url found in Atlassian integration for integrationId: ${integrationId}`)
        }

        const cloudId = integration.cloud_id
        const baseUrl = integration.base_url

        try {
            // Fetch page using REST API v2
            const pageInfo = await fetchConfluencePage(cloudId, pageId, accessToken, "storage")

            // Extract metadata, body, and relationships
            const metadata = extractPageMetadata(pageInfo)
            const body = extractBodyContent(pageInfo)
            const { ancestors, descendants } = extractAncestorsAndDescendants(pageInfo)

            const body_text = body.storage?.value || body.view?.value || body.export_view?.value || ""
            const pageNameDisplay = metadata.title || pageId

            // Return action as part of the result
            const pageUrl = `https://${baseUrl}/wiki${pageInfo._links?.webui || ""}`
            const action = {
                action: "Queried Confluence page",
                integration: IntegrationType.ATLASSIAN,
                target: pageNameDisplay,
                details: `Retrieved page content: ${body_text.length} characters, ${ancestors.length} ancestor(s), ${descendants.length} descendant(s)`,
                url: pageUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...metadata,
                body: body,
                actions: [action],
                body_text: body_text,
                ancestors: ancestors,
                descendants: descendants,
                ancestors_count: ancestors.length,
                descendants_count: descendants.length
            }
        } catch (error) {
            logger.error("Error fetching Confluence page", { error, pageId })
            throw new Error(`Failed to fetch Confluence page: ${error instanceof Error ? error.message : String(error)}`)
        }
    },
    errorFunction: formatError
})

const confluenceAddCommentTool = tool({
    name: ToolName.CONFLUENCE_ADD_COMMENT,
    description: `Add an inline comment to a specific location in the Confluence page.

This tool adds an inline comment attached to a specific text range in the page. You can specify the text to comment on, or provide start/end positions in the page content.

To find the correct position, first call confluence_query_page to see the page content, then identify the text range you want to comment on.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Atlassian/Confluence integration to use."),
        pageId: z.string().describe("The Confluence page ID to add a comment to."),
        comment_text: z.string().describe("The text content of the comment to add."),
        text_to_comment_on: z
            .string()
            .nullable()
            .optional()
            .describe(
                "Optional: The specific text in the page that this comment refers to. If provided, the tool will try to find this text and attach the comment to it. If not provided, you must specify start_position and end_position."
            ),
        start_position: z
            .number()
            .nullable()
            .optional()
            .describe("Optional: The start character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided."),
        end_position: z
            .number()
            .nullable()
            .optional()
            .describe("Optional: The end character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.")
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.CONFLUENCE_ADD_COMMENT),
    execute: async ({ integrationId, pageId, comment_text, text_to_comment_on, start_position, end_position }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("[Confluence Add Comment] Executing confluence_add_comment tool", {
            integrationId,
            pageId,
            comment_text,
            text_to_comment_on,
            start_position,
            end_position
        })
        if (!runContext?.context) {
            throw new Error(chalk.red.bold("No context provided"))
        }

        const manager = new AtlassianClient()
        const user = runContext.context.user
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Atlassian integration not found or access denied for integrationId: ${integrationId}`)
        }

        // Ensure the integration belongs to the user's organization
        const integration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId, organization_id: user.organizationId },
            select: { cloud_id: true, base_url: true }
        })

        if (!integration || !integration.cloud_id) {
            throw new Error(`Atlassian integration not found, not in your organization, or missing cloud ID for integrationId: ${integrationId}`)
        }

        const cloudId = integration.cloud_id

        try {
            // Fetch the page content
            const pageInfo = await fetchConfluencePage(cloudId, pageId, accessToken, "storage")

            const storageContent = extractStorageContent(pageInfo)
            const plainTextContent = stripHtmlTags(storageContent)

            // Determine start and end positions
            let startPos = start_position ?? undefined
            let endPos = end_position ?? undefined

            // If text_to_comment_on is provided, find its position and map to storage format
            if (text_to_comment_on && text_to_comment_on !== null && startPos === undefined && endPos === undefined) {
                const plainTextIndex = plainTextContent.indexOf(text_to_comment_on)

                if (plainTextIndex === -1) {
                    throw new Error(`Could not find the text "${text_to_comment_on}" in the page content. Please check the text and try again, or use start_position and end_position instead.`)
                }

                // Map plain text positions to storage format positions
                const positions = mapPlainTextRangeToStoragePositions(storageContent, plainTextIndex, text_to_comment_on.length)
                startPos = positions.start
                endPos = positions.end
            }

            if (startPos === undefined || endPos === undefined) {
                throw new Error("Either text_to_comment_on or both start_position and end_position must be provided.")
            }

            // Format comment as Confluence Storage Format
            const storageFormatBody = formatCommentAsStorage(comment_text)

            // Get the selected text for textSelection (plain text, not XHTML)
            const selectedText = text_to_comment_on && text_to_comment_on !== null ? text_to_comment_on : stripHtmlTags(storageContent.substring(startPos, endPos))

            // Calculate match index and count
            const plainTextStartPos = mapStorageToPlainTextPosition(storageContent, startPos)
            const { matchIndex, matchCount } = findTextMatches(plainTextContent, selectedText, plainTextStartPos)

            // Create inline comment via API
            const apiUrl = `${getConfluenceApiBaseUrl(cloudId)}/inline-comments`
            const requestBody: InlineCommentRequestBody = {
                pageId: pageId,
                body: {
                    representation: "storage",
                    value: storageFormatBody
                },
                inlineCommentProperties: {
                    position: {
                        start: startPos,
                        end: endPos
                    },
                    textSelection: selectedText,
                    textSelectionMatchIndex: matchIndex,
                    textSelectionMatchCount: matchCount
                }
            }

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getConfluenceApiHeaders(accessToken)
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Failed to add inline comment: ${response.status} ${response.statusText} - ${errorText}`)
            }

            const commentResponse = (await response.json()) as InlineCommentResponse

            // Extract metadata to get page name
            const metadata = extractPageMetadata(pageInfo)
            const pageNameDisplay = metadata.title || pageId

            // Report action
            const commentPreview = comment_text.length > 60 ? comment_text.substring(0, 60) + "..." : comment_text
            const action = {
                action: "Added Inline comment",
                integration: IntegrationType.ATLASSIAN,
                target: pageNameDisplay,
                details: commentPreview,
                type: "create"
            }

            return {
                success: true,
                comment_id: commentResponse.id,
                actions: [action],
                comment_text: comment_text,
                position: {
                    start: startPos,
                    end: endPos
                },
                text_commented_on: text_to_comment_on ?? undefined,
                message: "Inline comment added successfully to the page"
            }
        } catch (error) {
            logger.error("Error adding Confluence inline comment", {
                error,
                comment_text,
                text_to_comment_on,
                start_position,
                end_position
            })
            throw new Error(`Failed to add Confluence inline comment: ${error instanceof Error ? error.message : String(error)}`)
        }
    },
    errorFunction: formatError
})

// MARK: - Types

// Import types from confluence.js using type-only imports
type Content = import("confluence.js").Models.Content
type Space = import("confluence.js").Models.Space
type Version = import("confluence.js").Models.Version

interface PageMetadata {
    page_id: string
    title: string
    type: string
    status: string
    space?: {
        id: string | number
        key: string
        name: string
        type: string
    }
    version?: {
        number: number
        when: string
        message?: string
        by?: {
            type: string
            username?: string
            userKey?: string
            accountId?: string
            displayName?: string
        }
    }
    created_date?: string
    last_modified?: string
    url?: string
}

interface BodyContent {
    storage?: {
        value: string
        representation: string
    }
    view?: {
        value: string
        representation: string
    }
    export_view?: {
        value: string
        representation: string
    }
}

interface AncestorOrDescendant {
    id: string
    title: string
    type: string
}

interface InlineCommentRequestBody {
    pageId: string
    body: {
        representation: string
        value: string
    }
    inlineCommentProperties: {
        position: {
            start: number
            end: number
        }
        textSelection: string
        textSelectionMatchIndex: number
        textSelectionMatchCount: number
    }
}

interface InlineCommentResponse {
    id: string
    [key: string]: unknown
}

// MARK: - Helpers

/**
 * Constructs the Confluence API base URL for OAuth integrations
 */
function getConfluenceApiBaseUrl(cloudId: string): string {
    return `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2`
}

/**
 * Creates standard headers for Confluence API requests
 */
function getConfluenceApiHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
    }
}

/**
 * Fetches a Confluence page by ID using the REST API v2
 */
async function fetchConfluencePage(cloudId: string, pageId: string, accessToken: string, bodyFormat: "storage" | "view" | "export_view" = "storage"): Promise<any> {
    const apiBaseUrl = getConfluenceApiBaseUrl(cloudId)
    const pageUrl = `${apiBaseUrl}/pages/${pageId}?body-format=${bodyFormat}`

    const response = await fetch(pageUrl, {
        method: "GET",
        headers: getConfluenceApiHeaders(accessToken)
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Confluence API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
}

/**
 * Extracts storage content from Confluence API v2 page response
 */
function extractStorageContent(pageInfo: any): string {
    if (pageInfo.body?.storage) {
        return typeof pageInfo.body.storage === "string" ? pageInfo.body.storage : pageInfo.body.storage.value || ""
    } else if (pageInfo.body) {
        // Fallback: body might be directly in pageInfo.body
        return typeof pageInfo.body === "string" ? pageInfo.body : pageInfo.body.value || ""
    }
    return ""
}

/**
 * Extracts body content in different formats from page response
 */
function extractBodyContent(pageInfo: any): BodyContent {
    const body: BodyContent = {}
    const storageContent = extractStorageContent(pageInfo)

    if (storageContent) {
        body.storage = {
            value: storageContent,
            representation: "storage"
        }
        // Use storage format for view and export_view as fallback
        body.view = {
            value: storageContent,
            representation: "view"
        }
        body.export_view = {
            value: storageContent,
            representation: "export_view"
        }
    }

    return body
}

/**
 * Extracts page metadata from Confluence API v2 response
 */
function extractPageMetadata(pageInfo: any): PageMetadata {
    return {
        page_id: pageInfo.id,
        title: pageInfo.title || "Untitled",
        type: pageInfo.type || "page",
        status: pageInfo.status || "current",
        space: pageInfo.space
            ? {
                  id: pageInfo.space.id || pageInfo.spaceId,
                  key: pageInfo.space.key || pageInfo.spaceId || String(pageInfo.space.id),
                  name: pageInfo.space.name || pageInfo.spaceId || String(pageInfo.space.id),
                  type: pageInfo.space.type || "space"
              }
            : pageInfo.spaceId
              ? {
                    id: pageInfo.spaceId,
                    key: pageInfo.spaceId,
                    name: pageInfo.spaceId,
                    type: "space"
                }
              : undefined,
        version: pageInfo.version
            ? {
                  number: pageInfo.version.number,
                  when: pageInfo.version.when || pageInfo.version.createdAt || "",
                  message: pageInfo.version.message,
                  by: pageInfo.version.by
                      ? {
                            type: pageInfo.version.by.type,
                            username: pageInfo.version.by.username,
                            userKey: pageInfo.version.by.userKey,
                            accountId: pageInfo.version.by.accountId,
                            displayName: pageInfo.version.by.displayName
                        }
                      : undefined
              }
            : undefined,
        created_date: pageInfo.createdDate || pageInfo.createdAt,
        last_modified: pageInfo.lastModified || pageInfo.version?.createdAt,
        url: pageInfo._links?.webui || (pageInfo._links?.base && pageInfo._links?.webui ? pageInfo._links.base + pageInfo._links.webui : undefined)
    }
}

/**
 * Extracts ancestors and descendants from page response
 */
function extractAncestorsAndDescendants(pageInfo: any): {
    ancestors: AncestorOrDescendant[]
    descendants: AncestorOrDescendant[]
} {
    const ancestors: AncestorOrDescendant[] = pageInfo.parentId
        ? [
              {
                  id: String(pageInfo.parentId),
                  title: pageInfo.parentTitle || "Parent page",
                  type: pageInfo.parentType || "page"
              }
          ]
        : Array.isArray(pageInfo.ancestors)
          ? pageInfo.ancestors.map((ancestor: any) => ({
                id: String(ancestor.id),
                title: ancestor.title || "Untitled",
                type: ancestor.type || "page"
            }))
          : []

    const descendants: AncestorOrDescendant[] =
        pageInfo.descendants && typeof pageInfo.descendants === "object" && "results" in pageInfo.descendants
            ? (pageInfo.descendants as { results: any[] }).results.map((descendant: any) => ({
                  id: String(descendant.id),
                  title: descendant.title || "Untitled",
                  type: descendant.type || "page"
              }))
            : Array.isArray(pageInfo.descendants)
              ? pageInfo.descendants.map((descendant: any) => ({
                    id: String(descendant.id),
                    title: descendant.title || "Untitled",
                    type: descendant.type || "page"
                }))
              : []

    return { ancestors, descendants }
}

/**
 * Maps a plain text position to a storage format position
 */
function mapPlainTextToStoragePosition(storageContent: string, plainTextPosition: number): number {
    let storagePos = 0
    let plainTextPos = 0
    let inTag = false

    for (let i = 0; i < storageContent.length && plainTextPos < plainTextPosition; i++) {
        if (storageContent[i] === "<") {
            inTag = true
        } else if (storageContent[i] === ">") {
            inTag = false
        } else if (!inTag) {
            // Skip entity references
            if (storageContent[i] === "&") {
                const entityEnd = storageContent.indexOf(";", i)
                if (entityEnd !== -1) {
                    i = entityEnd
                    plainTextPos++
                    continue
                }
            }
            plainTextPos++
        }
        storagePos = i + 1
    }

    return storagePos
}

/**
 * Maps a plain text range to storage format positions
 */
function mapPlainTextRangeToStoragePositions(storageContent: string, plainTextStart: number, plainTextLength: number): { start: number; end: number } {
    const startPos = mapPlainTextToStoragePosition(storageContent, plainTextStart)
    const endPlainTextPos = plainTextStart + plainTextLength

    let endStoragePos = startPos
    let endPlainTextCount = plainTextStart
    let inTag = false

    for (let i = startPos; i < storageContent.length && endPlainTextCount < endPlainTextPos; i++) {
        if (storageContent[i] === "<") {
            inTag = true
        } else if (storageContent[i] === ">") {
            inTag = false
        } else if (!inTag) {
            if (storageContent[i] === "&") {
                const entityEnd = storageContent.indexOf(";", i)
                if (entityEnd !== -1) {
                    i = entityEnd
                    endPlainTextCount++
                    endStoragePos = i + 1
                    continue
                }
            }
            endPlainTextCount++
        }
        endStoragePos = i + 1
    }

    return { start: startPos, end: endStoragePos }
}

/**
 * Calculates the plain text position that corresponds to a storage position
 */
function mapStorageToPlainTextPosition(storageContent: string, storagePosition: number): number {
    let plainTextCount = 0
    let inTag = false

    for (let i = 0; i < Math.min(storagePosition, storageContent.length); i++) {
        if (storageContent[i] === "<") {
            inTag = true
        } else if (storageContent[i] === ">") {
            inTag = false
        } else if (!inTag) {
            if (storageContent[i] === "&") {
                const entityEnd = storageContent.indexOf(";", i)
                if (entityEnd !== -1) {
                    i = entityEnd
                    plainTextCount++
                    continue
                }
            }
            plainTextCount++
        }
    }

    return plainTextCount
}

/**
 * Finds all occurrences of text in plain text and calculates match index
 */
function findTextMatches(plainTextContent: string, selectedText: string, startPlainTextPosition: number): { matchIndex: number; matchCount: number } {
    const matches: number[] = []
    let searchIndex = 0

    while ((searchIndex = plainTextContent.indexOf(selectedText, searchIndex)) !== -1) {
        matches.push(searchIndex)
        searchIndex += selectedText.length
    }

    const matchCount = matches.length || 1 // Default to 1 if no matches
    const matchIndex = matches.findIndex(pos => pos === startPlainTextPosition)

    return {
        matchIndex: matchIndex >= 0 ? matchIndex : 0,
        matchCount
    }
}

/**
 * Formats comment text as Confluence Storage Format
 */
function formatCommentAsStorage(commentText: string): string {
    const escapedCommentText = escapeXhtml(commentText)
    const paragraphs = escapedCommentText.split(/\n/)
    return paragraphs.length > 0 ? paragraphs.map(p => `<p>${p}</p>`).join("") : "<p></p>"
}

/**
 * Escapes special characters for XHTML/XML content
 */
function escapeXhtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

/**
 * Strips HTML tags to get plain text content and decodes HTML entities
 */
function stripHtmlTags(html: string): string {
    // First strip all HTML tags
    let text = html.replace(/<[^>]*>/g, "")
    // Then decode common HTML entities (must decode &amp; last)
    text = text.replace(/&nbsp;/g, " ")
    text = text.replace(/&lt;/g, "<")
    text = text.replace(/&gt;/g, ">")
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&apos;/g, "'")
    text = text.replace(/&amp;/g, "&")
    // Handle numeric entities
    text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    return text
}

// MARK: - Footer Instructions

const CONFLUENCE_FOOTER_INSTRUCTIONS = `
## TERSE FOOTER REQUIREMENT

You MUST always ensure a **Terse Footer** exists at the very bottom of the Confluence page after any update unless the user specifies otherwise. This footer provides transparency about when and how the page was last updated by Terse.

**IMPORTANT**: If the user provides custom footer formatting instructions in their USER_INSTRUCTIONS, use their format instead of the default format below. User instructions take precedence.

### Default Footer Content
The footer must include:
1. **Last Updated**: A human-readable timestamp of when this update was made (use the current time from the CURRENT TIME section)
2. **Status**: The outcome of the update - use "✓ Success" if changes were made successfully, "⊘ No changes needed" if no updates were required, or "✗ Failed" if something went wrong

### Confluence Storage Format
Use this exact XHTML structure for the footer (adapt the values accordingly):

\`\`\`xml
<hr/>
<ac:structured-macro ac:name="info" ac:schema-version="1">
  <ac:rich-text-body>
    <p><strong>Terse Automation Footer</strong></p>
    <table>
      <tbody>
        <tr>
          <td><strong>Last Updated</strong></td>
          <td>December 6, 2024 at 3:45 PM UTC</td>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td>✓ Success</td>
        </tr>
      </tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>
\`\`\`

### Important Rules
- If a Terse footer already exists (or a user's custom format footer), UPDATE it with the new values rather than creating a duplicate
- The footer must ALWAYS be at the very end of the page content
- Use the info macro (blue background) for visual distinction (unless user specifies otherwise)
- Format the timestamp in a human-friendly way (e.g., "December 6, 2024 at 3:45 PM UTC")
`.trim()
