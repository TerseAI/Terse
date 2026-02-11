import { LinearClient } from "@linear/sdk"
import type { IssueFilter, IssuesQueryVariables, PaginationOrderBy as PaginationOrderByType, SearchIssuesQueryVariables } from "@linear/sdk/dist/_generated_documents"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { LinearStateName } from "../../../shared/TicketSystem"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const linearStateNameValues = Object.values(LinearStateName)

export const linearSearchTicketTool = tool({
    name: ToolName.LINEAR_SEARCH_TICKET,
    description: `Searches Linear issues by keyword and/or state filter. Use this before reading individual tickets. Results are ordered by most recently updated first. Use 'after' cursor to paginate.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear integration to use."),
        searchTerm: z
            .string()
            .optional()
            .default("")
            .describe(
                `Plain-text keyword search (matched against titles, descriptions, etc.).
                Do NOT include operators or field filters. Use dedicated parameters instead.
                ✓ "block kit"
                ✗ "team:TER state:Done updated:>2026-02-04 block kit"`
            ),
        stateNames: z
            .array(z.nativeEnum(LinearStateName))
            .nullable()
            .optional()
            .describe(`Filter to only include issues with these state names. Available states: ${linearStateNameValues.join(", ")}.`),
        limit: z.number().nullable().optional().describe("Maximum number of issues to return. Defaults to 10 if not provided."),
        after: z.string().nullable().optional().describe("Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results.")
    }),
    execute: async ({ integrationId, searchTerm, stateNames, limit = 10, after }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_search_ticket tool", { integrationId, searchTerm, stateNames, limit, after })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new LinearIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
        }

        // Initialize Linear client with OAuth token
        const client = new LinearClient({
            accessToken
        })

        try {
            // Build filter options - filter by state names if provided
            const filter: IssueFilter | undefined =
                stateNames && stateNames.length > 0
                    ? {
                          state: {
                              name: { in: stateNames }
                          }
                      }
                    : undefined

            const hasSearchTerm = searchTerm && searchTerm.trim().length > 0

            let issues
            if (hasSearchTerm) {
                // Use searchIssues when a search term is provided
                const searchOptions: Omit<SearchIssuesQueryVariables, "term"> = {
                    filter,
                    first: limit,
                    orderBy: "updatedAt" as PaginationOrderByType,
                    ...(after && { after })
                }
                issues = await client.searchIssues(searchTerm, searchOptions)
            } else {
                // Use issues listing endpoint when no search term — avoids Linear's
                // "term must be longer than or equal to 1 characters" validation error
                const listOptions: IssuesQueryVariables = {
                    filter,
                    first: limit,
                    orderBy: "updatedAt" as PaginationOrderByType,
                    ...(after && { after })
                }
                issues = await client.issues(listOptions)
            }

            // Extract issue data from nodes (simpler pagination syntax)
            // Note: state and assignee are LinearFetch objects that need to be awaited
            const results = await Promise.all(
                issues.nodes.map(async issue => {
                    const state = issue.state ? await issue.state : null
                    const assignee = issue.assignee ? await issue.assignee : null

                    return {
                        id: issue.id,
                        identifier: issue.identifier,
                        title: issue.title,
                        description: issue.description,
                        state: state?.name || "Unknown",
                        priority: issue.priority,
                        assignee: assignee
                            ? {
                                  id: assignee.id,
                                  name: assignee.name,
                                  email: assignee.email || undefined
                              }
                            : null,
                        url: issue.url,
                        createdAt: issue.createdAt,
                        updatedAt: issue.updatedAt
                    }
                })
            )

            // Extract pagination info
            const pageInfo = issues.pageInfo || {}
            const hasNextPage = pageInfo.hasNextPage || false
            const endCursor = pageInfo.endCursor || null

            // Return action as part of the result
            const queryLabel = hasSearchTerm ? `matching "${searchTerm}"` : "with applied filters"
            const action = {
                action: "Searched tickets",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${results.length} issue(s) ${queryLabel}${hasNextPage ? " (more available)" : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                issues: results,
                actions: [action],
                count: results.length,
                query: searchTerm || "",
                pagination: {
                    hasNextPage,
                    endCursor,
                    limit
                }
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error searching Linear issues", { error: errorMessage, searchTerm })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the access token is valid and has the necessary permissions"
            }
        }
    },
    errorFunction: formatError
})
