import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { IntegrationType } from "../../../shared/Integrations";
import { JiraTicketSession } from "../JiraTicketOutput";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { RunHistoryActionType } from "@prisma/client";
import { formatError } from "../../../tools/toolUtils";
import logger from "../../../logger";
import { AtlassianIntegrationManager } from "../../../integrations/AtlassianIntegration";
import { db } from "../../../prismaClient";

export const jiraSearchTicketTool = tool({
    name: 'jira_search_ticket',
    description: `Search for Jira issues/tickets using JQL (Jira Query Language) or text search. Returns issues that match the search criteria.

Use this tool to find existing Jira issues before creating new ones or to look up ticket information.

JQL EXAMPLES:
- Basic text search: "text ~ 'search term'"
- By project: "project = PROJ"
- By assignee: "assignee = user@example.com"
- By status: "status = 'In Progress'"
- Combined: "project = PROJ AND status = 'In Progress' AND text ~ 'bug'"`,
    parameters: z.object({
        jql: z.string().nullable().optional().describe('JQL (Jira Query Language) query to search for issues. If not provided, will search all issues.'),
        text: z.string().nullable().optional().describe('Text to search for in issue titles and descriptions. If provided, will be converted to JQL: text ~ "search term"'),
        projectKey: z.string().nullable().optional().describe('Filter by Jira project key (e.g., "PROJ", "TEAM")'),
        assigneeEmail: z.string().nullable().optional().describe('Filter by assignee email address'),
        status: z.string().nullable().optional().describe('Filter by status name (e.g., "In Progress", "Done", "To Do")'),
        limit: z.number().nullable().optional().describe('Maximum number of issues to return. Defaults to 50 if not provided.'),
        startAt: z.number().nullable().optional().describe('The index of the first issue to return (0-based). Used for pagination.'),
    }),
    execute: async ({ 
        jql,
        text,
        projectKey,
        assigneeEmail,
        status,
        limit = 50,
        startAt = 0,
    }, runContext?: RunContext<SessionWithTracking<JiraTicketSession>>) => {
        logger.debug('🛠️ Executing jira_search_ticket tool', { jql, text, projectKey, assigneeEmail, status, limit, startAt });

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get the integration details
        const integrationId = runContext.context.jiraIntegration.id;
        const integrationManager = new AtlassianIntegrationManager();
        
        // Get valid access token
        const accessToken = await integrationManager.getAccessToken(integrationId);
        if (!accessToken) {
            throw new Error("No valid access token found for Jira integration");
        }

        // Get cloud_id from the integration
        const integration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId },
            select: { cloud_id: true },
        });

        if (!integration || !integration.cloud_id) {
            throw new Error("No cloud_id found in Jira integration");
        }

        const cloudId = integration.cloud_id;

        try {
            // Build JQL query
            let finalJql = jql || '';

            // If text is provided, add text search
            if (text) {
                const textQuery = `text ~ "${text.replace(/"/g, '\\"')}"`;
                if (finalJql) {
                    finalJql = `${finalJql} AND ${textQuery}`;
                } else {
                    finalJql = textQuery;
                }
            }

            // Add project filter if provided
            if (projectKey) {
                const projectQuery = `project = ${projectKey}`;
                if (finalJql) {
                    finalJql = `${finalJql} AND ${projectQuery}`;
                } else {
                    finalJql = projectQuery;
                }
            }

            // Add assignee filter if provided
            if (assigneeEmail) {
                const assigneeQuery = `assignee = "${assigneeEmail.replace(/"/g, '\\"')}"`;
                if (finalJql) {
                    finalJql = `${finalJql} AND ${assigneeQuery}`;
                } else {
                    finalJql = assigneeQuery;
                }
            }

            // Add status filter if provided
            if (status) {
                const statusQuery = `status = "${status.replace(/"/g, '\\"')}"`;
                if (finalJql) {
                    finalJql = `${finalJql} AND ${statusQuery}`;
                } else {
                    finalJql = statusQuery;
                }
            }

            // Default to all issues if no query provided
            if (!finalJql) {
                finalJql = 'ORDER BY updated DESC';
            } else {
                finalJql = `${finalJql} ORDER BY updated DESC`;
            }

            // Search for issues using REST API
            const response = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        jql: finalJql,
                        startAt: startAt,
                        maxResults: limit,
                        fields: [
                            'summary',
                            'description',
                            'status',
                            'assignee',
                            'priority',
                            'labels',
                            'duedate',
                            'project',
                            'created',
                            'updated',
                            'issuetype',
                        ],
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('❌ Error searching Jira issues', { status: response.status, error: errorText, jql: finalJql });
                throw new Error(`Failed to search Jira issues: ${errorText}`);
            }

            const searchResults = await response.json();

            // Convert issues to a consistent format
            const issues = (searchResults.issues || []).map((issue: any) => {
                // Convert REST API URL to browse URL
                let issueUrl: string | undefined;
                if (issue.self) {
                    try {
                        const urlObj = new URL(issue.self);
                        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
                        issueUrl = `${baseUrl}/browse/${issue.key}`;
                    } catch {
                        issueUrl = issue.self.replace(/\/rest\/api\/[23]\/issue\//, '/browse/');
                    }
                }

                return {
                    id: issue.id,
                    key: issue.key,
                    identifier: issue.key,
                    title: issue.fields.summary || '',
                    description: issue.fields.description || undefined,
                    state: issue.fields.status ? {
                        id: issue.fields.status.id,
                        name: issue.fields.status.name,
                    } : { id: '', name: 'Unknown' },
                    priority: issue.fields.priority ? parseInt(issue.fields.priority.id) : undefined,
                    assignee: issue.fields.assignee ? {
                        id: issue.fields.assignee.accountId,
                        name: issue.fields.assignee.displayName,
                        email: issue.fields.assignee.emailAddress || undefined,
                    } : null,
                    labels: issue.fields.labels || [],
                    dueDate: issue.fields.duedate || undefined,
                    project: issue.fields.project ? {
                        id: issue.fields.project.id,
                        name: issue.fields.project.name,
                        key: issue.fields.project.key,
                    } : undefined,
                    issueType: issue.fields.issuetype ? {
                        id: issue.fields.issuetype.id,
                        name: issue.fields.issuetype.name,
                    } : undefined,
                    url: issueUrl,
                    createdAt: issue.fields.created || undefined,
                    updatedAt: issue.fields.updated || undefined,
                };
            });

            // Track the action
            runContext.context.trackAction({
                action: 'Searched tickets',
                integration: IntegrationType.ATLASSIAN,
                target: 'Jira workspace',
                details: `Found ${issues.length} issue(s) matching search criteria${searchResults.total > issues.length ? ` (${searchResults.total} total)` : ''}`,
                type: RunHistoryActionType.read,
            });

            return {
                success: true,
                issues: issues,
                count: issues.length,
                total: searchResults.total || issues.length,
                startAt: searchResults.startAt || startAt,
                maxResults: searchResults.maxResults || limit,
                jql: finalJql,
            };
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error);
            throw new Error(errorMessage);
        }
    },
    errorFunction: formatError
});

