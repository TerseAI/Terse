import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { AtlassianClient } from "../../../integrations/AtlassianClient"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const jiraSearchTicketTool = tool({
    name: ToolName.JIRA_SEARCH_TICKET,
    description: `Search for Jira issues/tickets using JQL (Jira Query Language) or text search. Returns issues that match the search criteria.

Use this tool to find existing Jira issues before creating new ones or to look up ticket information.

PAGINATION:
This tool uses nextPageToken for pagination. To get the next page of results, call this tool again with the nextPageToken value from the previous response.

JQL EXAMPLES:
- Basic text search: "text ~ 'search term'"
- By project: "project = PROJ"
- By assignee: "assignee = user@example.com"
- By status: "status = 'In Progress'"
- Combined: "project = PROJ AND status = 'In Progress' AND text ~ 'bug'"`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Atlassian/Jira integration to use."),
        jql: z.string().nullable().optional().describe("JQL (Jira Query Language) query to search for issues. If not provided, will search all issues."),
        text: z.string().nullable().optional().describe('Text to search for in issue titles and descriptions. If provided, will be converted to JQL: text ~ "search term"'),
        projectKey: z.string().nullable().optional().describe('Filter by Jira project key (e.g., "PROJ", "TEAM")'),
        assigneeEmail: z.string().nullable().optional().describe("Filter by assignee email address"),
        status: z.string().nullable().optional().describe('Filter by status name (e.g., "In Progress", "Done", "To Do")'),
        limit: z.number().nullable().optional().describe("Maximum number of issues to return. Defaults to 50 if not provided."),
        nextPageToken: z
            .string()
            .nullable()
            .optional()
            .describe("Token from a previous search response to retrieve the next page of results. Use the nextPageToken value from the previous response to paginate through all results.")
    }),
    execute: async ({ integrationId, jql, text, projectKey, assigneeEmail, status, limit = 50, nextPageToken }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing jira_search_ticket tool", {
            integrationId,
            jql,
            text,
            projectKey,
            assigneeEmail,
            status,
            limit,
            nextPageToken
        })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user.organizationId
        const atlassianIntegration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!atlassianIntegration) {
            throw new Error(`Atlassian integration not found for integrationId: ${integrationId}`)
        }

        const integrationManager = new AtlassianClient()

        // Get valid access token with user ownership validation
        const accessToken = await integrationManager.getAccessToken(atlassianIntegration.id)
        if (!accessToken) {
            throw new Error(`Atlassian integration not found or access denied for integrationId: ${integrationId}`)
        }

        // Get cloud_id and base_url from the integration
        const integration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId },
            select: { cloud_id: true, base_url: true, jira_user_email: true }
        })

        if (!integration || !integration.cloud_id) {
            throw new Error(`Atlassian integration details not found for integrationId: ${integrationId}`)
        }

        if (!integration.base_url) {
            throw new Error(`No base_url found in Atlassian integration for integrationId: ${integrationId}`)
        }

        const cloudId = integration.cloud_id
        const baseUrl = integration.base_url

        try {
            // Build JQL query
            let finalJql = jql || ""

            // If text is provided, add text search
            if (text) {
                const textQuery = `text ~ "${text.replace(/"/g, '\\"')}"`
                if (finalJql) {
                    finalJql = `${finalJql} AND ${textQuery}`
                } else {
                    finalJql = textQuery
                }
            }

            // Add project filter if provided
            if (projectKey) {
                // Escape quotes and wrap in quotes for safety
                const escapedProjectKey = projectKey.replace(/"/g, '\\"')
                const projectQuery = `project = "${escapedProjectKey}"`
                if (finalJql) {
                    finalJql = `${finalJql} AND ${projectQuery}`
                } else {
                    finalJql = projectQuery
                }
            }

            // Add assignee filter if provided
            if (assigneeEmail) {
                const assigneeQuery = `assignee = "${assigneeEmail.replace(/"/g, '\\"')}"`
                if (finalJql) {
                    finalJql = `${finalJql} AND ${assigneeQuery}`
                } else {
                    finalJql = assigneeQuery
                }
            }

            // Add status filter if provided
            if (status) {
                const statusQuery = `status = "${status.replace(/"/g, '\\"')}"`
                if (finalJql) {
                    finalJql = `${finalJql} AND ${statusQuery}`
                } else {
                    finalJql = statusQuery
                }
            }

            // Default to all issues if no query provided
            if (!finalJql) {
                finalJql = "ORDER BY updated DESC"
            } else {
                finalJql = `${finalJql} ORDER BY updated DESC`
            }

            // Build query parameters for the new JQL enhanced search endpoint
            const fields = ["summary", "description", "status", "assignee", "priority", "labels", "duedate", "project", "created", "updated", "issuetype"]

            const queryParams = new URLSearchParams({
                jql: finalJql,
                maxResults: (limit ?? 50).toString(),
                fields: fields.join(",")
            })

            // Add nextPageToken for pagination if provided
            if (nextPageToken) {
                queryParams.append("nextPageToken", nextPageToken)
            }

            // Search for issues using the new JQL enhanced search endpoint
            const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?${queryParams.toString()}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error("❌ Error searching Jira issues", {
                    status: response.status,
                    error: errorText,
                    jql: finalJql
                })
                throw new Error(`Failed to search Jira issues: ${errorText}`)
            }

            const searchResults = await response.json()

            // The new API returns SearchAndReconcileResults with isLast and issues
            // Handle both new and old response formats for compatibility
            const issuesArray = searchResults.issues || []
            const isLast = searchResults.isLast ?? true
            const total = searchResults.total ?? issuesArray.length
            const maxResultsResult = searchResults.maxResults ?? limit ?? 50

            // Convert issues to a consistent format
            const issues = issuesArray.map((issue: any) => {
                // Construct browse URL using the base_url from integration session
                const issueUrl = `${baseUrl}/browse/${issue.key}`

                return {
                    id: issue.id,
                    key: issue.key,
                    identifier: issue.key,
                    title: issue.fields.summary || "",
                    description: issue.fields.description || undefined,
                    state: issue.fields.status
                        ? {
                              id: issue.fields.status.id,
                              name: issue.fields.status.name
                          }
                        : { id: "", name: "Unknown" },
                    priority: issue.fields.priority ? parseInt(issue.fields.priority.id) : undefined,
                    assignee: issue.fields.assignee
                        ? {
                              id: issue.fields.assignee.accountId,
                              name: issue.fields.assignee.displayName,
                              email: issue.fields.assignee.emailAddress || undefined
                          }
                        : null,
                    labels: issue.fields.labels || [],
                    dueDate: issue.fields.duedate || undefined,
                    project: issue.fields.project
                        ? {
                              id: issue.fields.project.id,
                              name: issue.fields.project.name,
                              key: issue.fields.project.key
                          }
                        : undefined,
                    issueType: issue.fields.issuetype
                        ? {
                              id: issue.fields.issuetype.id,
                              name: issue.fields.issuetype.name
                          }
                        : undefined,
                    url: issueUrl,
                    createdAt: issue.fields.created || undefined,
                    updatedAt: issue.fields.updated || undefined
                }
            })

            // Return action as part of the result
            const action = {
                action: "Searched tickets",
                integration: IntegrationType.ATLASSIAN,
                target: "Jira workspace",
                details: `Found ${issues.length} issue(s) matching search criteria${total > issues.length ? ` (${total} total)` : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                issues: issues,
                actions: [action],
                count: issues.length,
                total: total,
                maxResults: maxResultsResult,
                isLast: isLast,
                nextPageToken: searchResults.nextPageToken || undefined,
                jql: finalJql
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            throw new Error(errorMessage)
        }
    },
    errorFunction: formatError
})
