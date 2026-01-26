import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";
import { IntegrationType } from "../../../shared/Integrations";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import type { IssueFilter, SearchIssuesQueryVariables, PaginationOrderBy as PaginationOrderByType } from "@linear/sdk/dist/_generated_documents";
import { RunHistoryActionType } from "@prisma/client";
import { formatError } from "../../../tools/toolUtils";
import { ToolName } from "../../../tools/ToolNames";
import logger from "../../../logger";
import { Session } from "../../../types/session";
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration";


export const linearSearchTicketTool = tool({
    name: ToolName.LINEAR_SEARCH_TICKET,
    description: `Search for Linear issues/tickets by description or query. Returns issues that match the search criteria, excluding completed issues by default unless specified otherwise.

Use this tool to find existing Linear issues before creating new ones or to look up ticket information.`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the Linear integration to use.'),
        issueDescription: z.string().describe('The search query or description to search for in Linear issues. This will search in issue titles, descriptions, and other fields.'),
        excludeDone: z.boolean().nullable().optional().describe('Whether to exclude issues with state "Done". Defaults to true if not provided.'),
        limit: z.number().nullable().optional().describe('Maximum number of issues to return. Defaults to 10 if not provided.'),
        after: z.string().nullable().optional().describe('Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results.'),
    }),
    execute: async ({ integrationId, issueDescription, excludeDone = true, limit = 10, after }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug('🛠️ Executing linear_search_ticket tool', { integrationId, issueDescription, excludeDone, limit, after });

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const manager = new LinearIntegrationManager();
        const accessToken = await manager.getAccessToken(integrationId);
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`);
        }

        // Initialize Linear client with OAuth token
        const client = new LinearClient({
            accessToken
        });

        try {
            // Build filter options
            const filter: IssueFilter | undefined = excludeDone ? {
                state: {
                    name: { neq: "Done" }
                }
            } : undefined;

            // Search for issues using searchIssues method with pagination
            // Using first parameter to limit results and orderBy updatedAt for most recent
            // If after cursor is provided, use it for pagination
            const searchOptions: Omit<SearchIssuesQueryVariables, "term"> = {
                filter,
                first: limit,
                orderBy: "updatedAt" as PaginationOrderByType, // Order by most recently updated
                ...(after && { after }),
            };

            const issues = await client.searchIssues(issueDescription, searchOptions);

            // Extract issue data from nodes (simpler pagination syntax)
            // Note: state and assignee are LinearFetch objects that need to be awaited
            const results = await Promise.all(issues.nodes.map(async (issue) => {
                const state = issue.state ? await issue.state : null;
                const assignee = issue.assignee ? await issue.assignee : null;

                return {
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    description: issue.description,
                    state: state?.name || 'Unknown',
                    priority: issue.priority,
                    assignee: assignee ? {
                        id: assignee.id,
                        name: assignee.name,
                        email: assignee.email || undefined,
                    } : null,
                    url: issue.url,
                    createdAt: issue.createdAt,
                    updatedAt: issue.updatedAt,
                };
            }));

            // Extract pagination info
            const pageInfo = issues.pageInfo || {};
            const hasNextPage = pageInfo.hasNextPage || false;
            const endCursor = pageInfo.endCursor || null;

            // Return action as part of the result
            const action = {
                action: 'Searched tickets',
                integration: IntegrationType.LINEAR,
                target: 'Linear workspace',
                details: `Found ${results.length} issue(s) matching "${issueDescription}"${hasNextPage ? ' (more available)' : ''}`,
                type: RunHistoryActionType.read,
            };

            return {
                success: true,
                issues: results,
                actions: [action],
                count: results.length,
                query: issueDescription,
                pagination: {
                    hasNextPage,
                    endCursor,
                    limit,
                },
            };
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error);
            logger.error('❌ Error searching Linear issues', { error: errorMessage, issueDescription });
            return {
                success: false,
                error: errorMessage,
                hint: 'Check that the access token is valid and has the necessary permissions',
            };
        }
    },
    errorFunction: formatError
});

