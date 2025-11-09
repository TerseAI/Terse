import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { ConfluenceIntegration } from "../../shared/types";
import { AutomationOutput, User, AutomationConfluenceConfig } from "../../types/prisma";
import { Session } from "../../server";
import { Output, OutputType } from "./Output";
import { db } from "../../prismaClient";
import { RunContext, tool } from "@openai/agents";
import { ConfluenceClient } from 'confluence.js';
import { z } from "zod";

// Import types from confluence.js using type-only imports
type Content = import('confluence.js').Models.Content;
type Space = import('confluence.js').Models.Space;
type Version = import('confluence.js').Models.Version;

// Type definitions for page metadata
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

export interface ConfluenceSession extends Session {
    confluenceIntegration: ConfluenceIntegration; // Top level integration record
    confluenceConfig: AutomationConfluenceConfig; // Configuration for the Specific Confluence Database
    // Collect actions here (report-only); DB writes happen after agent finishes
    runActions?: RunHistoryAction[];
}

export class ConfluenceOutput extends Output<ConfluenceSession> {
    constructor() {
        const toolbox = [confluenceQueryPageTool, confluenceAddCommentTool];
        super(OutputType.Confluence, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        automationOutputConfig: AutomationOutput,
        user: User
    ): Promise<ConfluenceSession> {
        const integration = await db().jira_api_keys.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Confluence integration ${integrationId} not found`);
        }

        const confluenceConfig: AutomationConfluenceConfig | null = await db().automation_confluence_configs.findFirst({
            where: { automation_output_id: automationOutputConfig.id }
        });

        if (!confluenceConfig) {
            throw new Error(`Confluence config for automation output ${automationOutputConfig.id} not found`);
        }

        const confluenceIntegration: ConfluenceIntegration = {
            id: integration.id,
            confluence_user_email: integration.jira_user_email,
            api_key: integration.api_token,
            base_url: integration.base_url,
        };

        return { confluenceIntegration: confluenceIntegration, confluenceConfig: confluenceConfig, user: user, isUserInitiated: true, runActions: [] };
    }
}

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

        const client = new ConfluenceClient({
            host: runContext.context.confluenceIntegration.base_url,
            authentication: {
                basic: {
                    email: runContext.context.confluenceIntegration.confluence_user_email,
                    apiToken: runContext.context.confluenceIntegration.api_key,
                }
            }
        });

        const pageId = runContext.context.confluenceConfig.page_id as string;

        try {
            // Fetch page with body content, space, and version information
            const pageInfo: Content = await client.content.getContentById({
                id: pageId,
                expand: ['body.storage', 'body.view', 'body.export_view', 'space', 'version', 'ancestors', 'descendants'],
            });

            // Extract readable information
            const metadata: PageMetadata = {
                page_id: pageInfo.id,
                title: pageInfo.title || 'Untitled',
                type: pageInfo.type,
                status: pageInfo.status || 'current',
                space: pageInfo.space ? {
                    id: pageInfo.space.id,
                    key: pageInfo.space.key,
                    name: pageInfo.space.name,
                    type: pageInfo.space.type,
                } : undefined,
                version: pageInfo.version ? {
                    number: pageInfo.version.number,
                    when: pageInfo.version.when,
                    message: pageInfo.version.message,
                    by: pageInfo.version.by ? {
                        type: pageInfo.version.by.type,
                        username: pageInfo.version.by.username,
                        userKey: pageInfo.version.by.userKey,
                        accountId: pageInfo.version.by.accountId,
                        displayName: pageInfo.version.by.displayName,
                    } : undefined,
                } : undefined,
                created_date: 'createdDate' in pageInfo ? (pageInfo as { createdDate?: string }).createdDate : undefined,
                last_modified: 'lastModified' in pageInfo ? (pageInfo as { lastModified?: string }).lastModified : undefined,
                url: pageInfo._links?.webui || (pageInfo._links?.base && pageInfo._links?.webui ? pageInfo._links.base + pageInfo._links.webui : undefined),
            };

            // Extract body content in different formats
            const body: BodyContent = {};
            if (pageInfo.body) {
                if (pageInfo.body.storage) {
                    body.storage = {
                        value: pageInfo.body.storage.value,
                        representation: pageInfo.body.storage.representation,
                    };
                }
                if (pageInfo.body.view) {
                    body.view = {
                        value: pageInfo.body.view.value,
                        representation: pageInfo.body.view.representation,
                    };
                }
                if (pageInfo.body.export_view) {
                    body.export_view = {
                        value: pageInfo.body.export_view.value,
                        representation: pageInfo.body.export_view.representation,
                    };
                }
            }

            // Extract ancestors and descendants if available
            const ancestors: AncestorOrDescendant[] = Array.isArray(pageInfo.ancestors) 
                ? pageInfo.ancestors.map((ancestor) => ({
                    id: String(ancestor.id),
                    title: ancestor.title || 'Untitled',
                    type: ancestor.type || 'page',
                }))
                : [];

            const descendants: AncestorOrDescendant[] = pageInfo.descendants && typeof pageInfo.descendants === 'object' && 'results' in pageInfo.descendants
                ? (pageInfo.descendants as { results: Content[] }).results.map((descendant) => ({
                    id: String(descendant.id),
                    title: descendant.title || 'Untitled',
                    type: descendant.type || 'page',
                }))
                : Array.isArray(pageInfo.descendants)
                ? pageInfo.descendants.map((descendant) => ({
                    id: String(descendant.id),
                    title: descendant.title || 'Untitled',
                    type: descendant.type || 'page',
                }))
                : [];

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
        console.log("Executing confluence_add_comment tool");
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const client = new ConfluenceClient({
            host: runContext.context.confluenceIntegration.base_url,
            authentication: {
                basic: {
                    email: runContext.context.confluenceIntegration.confluence_user_email,
                    apiToken: runContext.context.confluenceIntegration.api_key,
                }
            }
        });

        const pageId = runContext.context.confluenceConfig.page_id as string;

        try {
            // If text_to_comment_on is provided, we need to find its position in the page
            let startPos = start_position ?? undefined;
            let endPos = end_position ?? undefined;

            if (text_to_comment_on && text_to_comment_on !== null && startPos === undefined && endPos === undefined) {
                // Fetch the page to find the text position
                const pageInfo: Content = await client.content.getContentById({
                    id: pageId,
                    expand: ['body.storage'],
                });

                const storageContent = pageInfo.body?.storage?.value || '';
                const textIndex = storageContent.indexOf(text_to_comment_on);
                
                if (textIndex === -1) {
                    throw new Error(`Could not find the text "${text_to_comment_on}" in the page content. Please check the text and try again, or use start_position and end_position instead.`);
                }

                startPos = textIndex;
                endPos = textIndex + text_to_comment_on.length;
            }

            if (startPos === undefined || endPos === undefined) {
                throw new Error('Either text_to_comment_on or both start_position and end_position must be provided.');
            }

            // Use Confluence Storage Format for the comment body
            const storageFormatBody = `<p>${comment_text.replace(/\n/g, '</p><p>')}</p>`;

            // Fetch the page content once to get the text and calculate matches
            const pageInfo: Content = await client.content.getContentById({
                id: pageId,
                expand: ['body.storage'],
            });
            const storageContent = pageInfo.body?.storage?.value || '';

            // Get the selected text from the page content for textSelection
            let selectedText = '';
            if (text_to_comment_on && text_to_comment_on !== null) {
                selectedText = text_to_comment_on;
            } else {
                // Extract text at the specified position
                selectedText = storageContent.substring(startPos, endPos);
            }

            // Find all occurrences of the selected text to calculate match index and count
            let matchIndex = 0;
            let matchCount = 0;
            let searchIndex = 0;
            const matches: number[] = [];
            
            while ((searchIndex = storageContent.indexOf(selectedText, searchIndex)) !== -1) {
                matches.push(searchIndex);
                if (searchIndex === startPos) {
                    matchIndex = matches.length - 1;
                }
                searchIndex += selectedText.length;
            }
            matchCount = matches.length;
            
            // If no matches found, default to 1 match at index 0
            if (matchCount === 0) {
                matchCount = 1;
                matchIndex = 0;
            }

            // Use the Confluence REST API v2 inline comments endpoint
            // Since confluence.js might not have this method, we'll make a direct HTTP request
            const baseUrl = runContext.context.confluenceIntegration.base_url.replace(/\/$/, '');
            const apiUrl = `${baseUrl}/wiki/api/v2/inline-comments`;

            // Build the request body according to Confluence API v2 format for inline comments
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
                    'Authorization': `Basic ${Buffer.from(`${runContext.context.confluenceIntegration.confluence_user_email}:${runContext.context.confluenceIntegration.api_key}`).toString('base64')}`,
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to add inline comment: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const commentResponse = await response.json() as InlineCommentResponse;

            // Report action
            runContext.context.runActions = runContext.context.runActions || [];
            runContext.context.runActions.push({
                action: 'add_inline_comment',
                integration: 'confluence',
                target: runContext.context.confluenceConfig.page_id || runContext.context.confluenceConfig.page_name || 'unknown',
                details: `Added inline comment at position ${startPos}-${endPos}: ${comment_text.substring(0, 50)}${comment_text.length > 50 ? '...' : ''}`,
            });

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