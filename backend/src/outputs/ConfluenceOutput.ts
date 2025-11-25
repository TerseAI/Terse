import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { AtlassianIntegration, IntegrationType } from "../shared/Integrations";
import { ChannelOutput, User, ChannelConfluenceConfig, PrismaTransaction } from "../types/prisma";
import { Session } from "../server";
import { Output, ToolboxEntry } from "./abstract/Output";
import { db } from "../prismaClient";
import { RunContext, Tool, tool } from "@openai/agents";
import { z } from "zod";
import chalk from "chalk";
import { OutputConfigType } from "@prisma/client";
import { ConfluenceConfig } from "../shared/Configs";

// MARK: - Exports

export interface ConfluenceSession extends Session {
    atlassianIntegration: AtlassianIntegration; // Top level integration record
    confluenceConfig: ChannelConfluenceConfig; // Configuration for the Specific Confluence Database
    apiToken: string; // API token stored separately (not in shared type for security)
    cloudId?: string; // Cloud ID for OAuth API gateway access
}

export class ConfluenceOutput extends Output<ConfluenceSession, ConfluenceConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: confluenceQueryPageTool as Tool, isReadOnly: true },
            { tool: confluenceAddCommentTool as Tool, isReadOnly: false },
        ];
        super(OutputConfigType.CONFLUENCE, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        channelOutputConfig: ChannelOutput,
        user: User
    ): Promise<ConfluenceSession> {
        // Fetch OAuth integration
        const oauthIntegration = await db().atlassian_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!oauthIntegration) {
            throw new Error(`Confluence integration ${integrationId} not found`);
        }

        // Fetch Confluence configuration
        const confluenceConfig = await db().automation_confluence_configs.findFirst({
            where: { automation_output_id: channelOutputConfig.id }
        });

        if (!confluenceConfig) {
            throw new Error(`Confluence config for automation output ${channelOutputConfig.id} not found`);
        }

        // Build Atlassian integration object
        const atlassianIntegration: AtlassianIntegration = {
            id: oauthIntegration.id,
            email: oauthIntegration.jira_user_email,
            baseUrl: oauthIntegration.base_url,
        };

        return { 
            atlassianIntegration, 
            confluenceConfig, 
            apiToken: oauthIntegration.access_token,
            cloudId: oauthIntegration.cloud_id || undefined,
            user, 
            isUserInitiated: true
        };
    }

    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: ConfluenceConfig): Promise<void> {
        await tx.automation_confluence_configs.create({
            data: {
                automation_output_id: channelOutputId,
                space_name: output.spaceName,
                space_id: output.spaceId,
                page_id: output.pageId,
                page_name: output.pageName,
            },
        });
    }
}

// MARK: - Tools

const confluenceQueryPageTool = tool({
    name: 'confluence_query_page',
    description: `ALWAYS CALL THIS FIRST. DO NOT MODIFY ANYTHING WITHOUT CALLING THIS FIRST.

This tool returns the current state of the Confluence page including all metadata, properties, and content body.`,
    parameters: z.object({
        // No parameters needed - returns complete page information from configuration
    }),
    execute: async ({ }, runContext?: RunContext<ConfluenceSession>) => {
        console.log("Executing confluence_query_page tool");
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.cloudId) {
            throw new Error("Cloud ID is required for Confluence API access");
        }

        const pageId = runContext.context.confluenceConfig.page_id as string;

        try {
            // Fetch page using REST API v2
            const pageInfo = await fetchConfluencePage(
                runContext.context.cloudId,
                pageId,
                runContext.context.apiToken,
                'storage'
            );

            // Extract metadata, body, and relationships
            const metadata = extractPageMetadata(pageInfo);
            const body = extractBodyContent(pageInfo);
            const { ancestors, descendants } = extractAncestorsAndDescendants(pageInfo);

            return {
                ...metadata,
                body: body,
                body_text: body.storage?.value || body.view?.value || body.export_view?.value || '',
                ancestors: ancestors,
                descendants: descendants,
                ancestors_count: ancestors.length,
                descendants_count: descendants.length,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error fetching Confluence page:", errorMessage);
            throw new Error(`Failed to fetch Confluence page: ${errorMessage}`);
        }
    }
});

const confluenceAddCommentTool = tool({
    name: 'confluence_add_comment',
    description: `Add an inline comment to a specific location in the Confluence page.

This tool adds an inline comment attached to a specific text range in the page. You can specify the text to comment on, or provide start/end positions in the page content.

To find the correct position, first call confluence_query_page to see the page content, then identify the text range you want to comment on.`,
    parameters: z.object({
        comment_text: z.string().describe('The text content of the comment to add.'),
        text_to_comment_on: z.string().nullable().optional().describe('Optional: The specific text in the page that this comment refers to. If provided, the tool will try to find this text and attach the comment to it. If not provided, you must specify start_position and end_position.'),
        start_position: z.number().nullable().optional().describe('Optional: The start character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.'),
        end_position: z.number().nullable().optional().describe('Optional: The end character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.'),
    }),
    execute: async ({ comment_text, text_to_comment_on, start_position, end_position }, runContext?: RunContext<ConfluenceSession>) => {
        // Use chalk for highlighting the log output
        console.log(chalk.bgBlue.white.bold("[Confluence Add Comment]"), chalk.yellow("Executing confluence_add_comment tool: "), chalk.cyan(comment_text), chalk.magenta(text_to_comment_on), chalk.green(start_position), chalk.green(end_position));
        if (!runContext?.context) {
            throw new Error(chalk.red.bold("No context provided"));
        }

        if (!runContext.context.cloudId) {
            throw new Error("Cloud ID is required for Confluence API access");
        }

        const pageId = runContext.context.confluenceConfig.page_id as string;
        const apiBaseUrl = `https://api.atlassian.com/ex/confluence/${runContext.context.cloudId}/wiki/api/v2`;

        try {
            // Fetch the page content
            const pageInfo = await fetchConfluencePage(
                runContext.context.cloudId,
                pageId,
                runContext.context.apiToken,
                'storage'
            );
            
            // Extract page URL from metadata
            const pageMetadata = extractPageMetadata(pageInfo);
            const pageUrl = pageMetadata.url;
            
            const storageContent = extractStorageContent(pageInfo);
            const plainTextContent = stripHtmlTags(storageContent);

            // Determine start and end positions
            let startPos = start_position ?? undefined;
            let endPos = end_position ?? undefined;

            // If text_to_comment_on is provided, find its position and map to storage format
            if (text_to_comment_on && text_to_comment_on !== null && startPos === undefined && endPos === undefined) {
                const plainTextIndex = plainTextContent.indexOf(text_to_comment_on);
                
                if (plainTextIndex === -1) {
                    throw new Error(`Could not find the text "${text_to_comment_on}" in the page content. Please check the text and try again, or use start_position and end_position instead.`);
                }

                // Map plain text positions to storage format positions
                const positions = mapPlainTextRangeToStoragePositions(
                    storageContent,
                    plainTextIndex,
                    text_to_comment_on.length
                );
                startPos = positions.start;
                endPos = positions.end;
            }

            if (startPos === undefined || endPos === undefined) {
                throw new Error('Either text_to_comment_on or both start_position and end_position must be provided.');
            }

            // Format comment as Confluence Storage Format
            const storageFormatBody = formatCommentAsStorage(comment_text);

            // Get the selected text for textSelection (plain text, not XHTML)
            const selectedText = text_to_comment_on && text_to_comment_on !== null
                ? text_to_comment_on
                : stripHtmlTags(storageContent.substring(startPos, endPos));

            // Calculate match index and count
            const plainTextStartPos = mapStorageToPlainTextPosition(storageContent, startPos);
            const { matchIndex, matchCount } = findTextMatches(
                plainTextContent,
                selectedText,
                plainTextStartPos
            );

            // Create inline comment via API
            const apiUrl = `${getConfluenceApiBaseUrl(runContext.context.cloudId)}/inline-comments`;
            const requestBody: InlineCommentRequestBody = {
                pageId: pageId,
                body: {
                    representation: 'storage',
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
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getConfluenceApiHeaders(runContext.context.apiToken),
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to add inline comment: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const commentResponse = await response.json() as InlineCommentResponse;

            return {
                success: true,
                comment_id: commentResponse.id,
                comment_text: comment_text,
                position: {
                    start: startPos,
                    end: endPos
                },
                text_commented_on: text_to_comment_on ?? undefined,
                message: 'Inline comment added successfully to the page',
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error adding Confluence inline comment:", errorMessage);
            throw new Error(`Failed to add Confluence inline comment: ${errorMessage}`);
        }
    }
});

// MARK: - Types

// Import types from confluence.js using type-only imports
type Content = import('confluence.js').Models.Content;
type Space = import('confluence.js').Models.Space;
type Version = import('confluence.js').Models.Version;

interface PageMetadata {
    page_id: string;
    title: string;
    type: string;
    status: string;
    space?: {
        id: string | number;
        key: string;
        name: string;
        type: string;
    };
    version?: {
        number: number;
        when: string;
        message?: string;
        by?: {
            type: string;
            username?: string;
            userKey?: string;
            accountId?: string;
            displayName?: string;
        };
    };
    created_date?: string;
    last_modified?: string;
    url?: string;
}

interface BodyContent {
    storage?: {
        value: string;
        representation: string;
    };
    view?: {
        value: string;
        representation: string;
    };
    export_view?: {
        value: string;
        representation: string;
    };
}

interface AncestorOrDescendant {
    id: string;
    title: string;
    type: string;
}

interface InlineCommentRequestBody {
    pageId: string;
    body: {
        representation: string;
        value: string;
    };
    inlineCommentProperties: {
        position: {
            start: number;
            end: number;
        };
        textSelection: string;
        textSelectionMatchIndex: number;
        textSelectionMatchCount: number;
    };
}

interface InlineCommentResponse {
    id: string;
    [key: string]: unknown;
}

// MARK: - Helpers

/**
 * Constructs the Confluence API base URL for OAuth integrations
 */
function getConfluenceApiBaseUrl(cloudId: string): string {
    return `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2`;
}

/**
 * Creates standard headers for Confluence API requests
 */
function getConfluenceApiHeaders(accessToken: string): Record<string, string> {
    return {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
    };
}

/**
 * Fetches a Confluence page by ID using the REST API v2
 */
async function fetchConfluencePage(
    cloudId: string,
    pageId: string,
    accessToken: string,
    bodyFormat: 'storage' | 'view' | 'export_view' = 'storage'
): Promise<any> {
    const apiBaseUrl = getConfluenceApiBaseUrl(cloudId);
    const pageUrl = `${apiBaseUrl}/pages/${pageId}?body-format=${bodyFormat}`;
    
    const response = await fetch(pageUrl, {
        method: 'GET',
        headers: getConfluenceApiHeaders(accessToken),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Confluence API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Extracts storage content from Confluence API v2 page response
 */
function extractStorageContent(pageInfo: any): string {
    if (pageInfo.body?.storage) {
        return typeof pageInfo.body.storage === 'string' 
            ? pageInfo.body.storage 
            : pageInfo.body.storage.value || '';
    } else if (pageInfo.body) {
        // Fallback: body might be directly in pageInfo.body
        return typeof pageInfo.body === 'string' 
            ? pageInfo.body 
            : pageInfo.body.value || '';
    }
    return '';
}

/**
 * Extracts body content in different formats from page response
 */
function extractBodyContent(pageInfo: any): BodyContent {
    const body: BodyContent = {};
    const storageContent = extractStorageContent(pageInfo);
    
    if (storageContent) {
        body.storage = {
            value: storageContent,
            representation: 'storage',
        };
        // Use storage format for view and export_view as fallback
        body.view = {
            value: storageContent,
            representation: 'view',
        };
        body.export_view = {
            value: storageContent,
            representation: 'export_view',
        };
    }
    
    return body;
}

/**
 * Extracts page metadata from Confluence API v2 response
 */
function extractPageMetadata(pageInfo: any): PageMetadata {
    return {
        page_id: pageInfo.id,
        title: pageInfo.title || 'Untitled',
        type: pageInfo.type || 'page',
        status: pageInfo.status || 'current',
        space: pageInfo.space ? {
            id: pageInfo.space.id || pageInfo.spaceId,
            key: pageInfo.space.key || pageInfo.spaceId || String(pageInfo.space.id),
            name: pageInfo.space.name || pageInfo.spaceId || String(pageInfo.space.id),
            type: pageInfo.space.type || 'space',
        } : pageInfo.spaceId ? {
            id: pageInfo.spaceId,
            key: pageInfo.spaceId,
            name: pageInfo.spaceId,
            type: 'space',
        } : undefined,
        version: pageInfo.version ? {
            number: pageInfo.version.number,
            when: pageInfo.version.when || pageInfo.version.createdAt || '',
            message: pageInfo.version.message,
            by: pageInfo.version.by ? {
                type: pageInfo.version.by.type,
                username: pageInfo.version.by.username,
                userKey: pageInfo.version.by.userKey,
                accountId: pageInfo.version.by.accountId,
                displayName: pageInfo.version.by.displayName,
            } : undefined,
        } : undefined,
        created_date: pageInfo.createdDate || pageInfo.createdAt,
        last_modified: pageInfo.lastModified || pageInfo.version?.createdAt,
        url: pageInfo._links?.webui || (pageInfo._links?.base && pageInfo._links?.webui ? pageInfo._links.base + pageInfo._links.webui : undefined),
    };
}

/**
 * Extracts ancestors and descendants from page response
 */
function extractAncestorsAndDescendants(pageInfo: any): {
    ancestors: AncestorOrDescendant[];
    descendants: AncestorOrDescendant[];
} {
    const ancestors: AncestorOrDescendant[] = pageInfo.parentId ? [{
        id: String(pageInfo.parentId),
        title: pageInfo.parentTitle || 'Parent page',
        type: pageInfo.parentType || 'page',
    }] : Array.isArray(pageInfo.ancestors) 
        ? pageInfo.ancestors.map((ancestor: any) => ({
            id: String(ancestor.id),
            title: ancestor.title || 'Untitled',
            type: ancestor.type || 'page',
        }))
        : [];

    const descendants: AncestorOrDescendant[] = pageInfo.descendants && typeof pageInfo.descendants === 'object' && 'results' in pageInfo.descendants
        ? (pageInfo.descendants as { results: any[] }).results.map((descendant: any) => ({
            id: String(descendant.id),
            title: descendant.title || 'Untitled',
            type: descendant.type || 'page',
        }))
        : Array.isArray(pageInfo.descendants)
        ? pageInfo.descendants.map((descendant: any) => ({
            id: String(descendant.id),
            title: descendant.title || 'Untitled',
            type: descendant.type || 'page',
        }))
        : [];

    return { ancestors, descendants };
}

/**
 * Maps a plain text position to a storage format position
 */
function mapPlainTextToStoragePosition(
    storageContent: string,
    plainTextPosition: number
): number {
    let storagePos = 0;
    let plainTextPos = 0;
    let inTag = false;
    
    for (let i = 0; i < storageContent.length && plainTextPos < plainTextPosition; i++) {
        if (storageContent[i] === '<') {
            inTag = true;
        } else if (storageContent[i] === '>') {
            inTag = false;
        } else if (!inTag) {
            // Skip entity references
            if (storageContent[i] === '&') {
                const entityEnd = storageContent.indexOf(';', i);
                if (entityEnd !== -1) {
                    i = entityEnd;
                    plainTextPos++;
                    continue;
                }
            }
            plainTextPos++;
        }
        storagePos = i + 1;
    }
    
    return storagePos;
}

/**
 * Maps a plain text range to storage format positions
 */
function mapPlainTextRangeToStoragePositions(
    storageContent: string,
    plainTextStart: number,
    plainTextLength: number
): { start: number; end: number } {
    const startPos = mapPlainTextToStoragePosition(storageContent, plainTextStart);
    const endPlainTextPos = plainTextStart + plainTextLength;
    
    let endStoragePos = startPos;
    let endPlainTextCount = plainTextStart;
    let inTag = false;
    
    for (let i = startPos; i < storageContent.length && endPlainTextCount < endPlainTextPos; i++) {
        if (storageContent[i] === '<') {
            inTag = true;
        } else if (storageContent[i] === '>') {
            inTag = false;
        } else if (!inTag) {
            if (storageContent[i] === '&') {
                const entityEnd = storageContent.indexOf(';', i);
                if (entityEnd !== -1) {
                    i = entityEnd;
                    endPlainTextCount++;
                    endStoragePos = i + 1;
                    continue;
                }
            }
            endPlainTextCount++;
        }
        endStoragePos = i + 1;
    }
    
    return { start: startPos, end: endStoragePos };
}

/**
 * Calculates the plain text position that corresponds to a storage position
 */
function mapStorageToPlainTextPosition(
    storageContent: string,
    storagePosition: number
): number {
    let plainTextCount = 0;
    let inTag = false;
    
    for (let i = 0; i < Math.min(storagePosition, storageContent.length); i++) {
        if (storageContent[i] === '<') {
            inTag = true;
        } else if (storageContent[i] === '>') {
            inTag = false;
        } else if (!inTag) {
            if (storageContent[i] === '&') {
                const entityEnd = storageContent.indexOf(';', i);
                if (entityEnd !== -1) {
                    i = entityEnd;
                    plainTextCount++;
                    continue;
                }
            }
            plainTextCount++;
        }
    }
    
    return plainTextCount;
}

/**
 * Finds all occurrences of text in plain text and calculates match index
 */
function findTextMatches(
    plainTextContent: string,
    selectedText: string,
    startPlainTextPosition: number
): { matchIndex: number; matchCount: number } {
    const matches: number[] = [];
    let searchIndex = 0;
    
    while ((searchIndex = plainTextContent.indexOf(selectedText, searchIndex)) !== -1) {
        matches.push(searchIndex);
        searchIndex += selectedText.length;
    }
    
    const matchCount = matches.length || 1; // Default to 1 if no matches
    const matchIndex = matches.findIndex(pos => pos === startPlainTextPosition);
    
    return {
        matchIndex: matchIndex >= 0 ? matchIndex : 0,
        matchCount,
    };
}

/**
 * Formats comment text as Confluence Storage Format
 */
function formatCommentAsStorage(commentText: string): string {
    const escapedCommentText = escapeXhtml(commentText);
    const paragraphs = escapedCommentText.split(/\n/);
    return paragraphs.length > 0 
        ? paragraphs.map(p => `<p>${p}</p>`).join('')
        : '<p></p>';
}

/**
 * Escapes special characters for XHTML/XML content
 */
function escapeXhtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Strips HTML tags to get plain text content and decodes HTML entities
 */
function stripHtmlTags(html: string): string {
    // First strip all HTML tags
    let text = html.replace(/<[^>]*>/g, '');
    // Then decode common HTML entities (must decode &amp; last)
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&apos;/g, "'");
    text = text.replace(/&amp;/g, '&');
    // Handle numeric entities
    text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return text;
}
