import { LinearClient } from "@linear/sdk"
import type { IssueFilter, IssuesQueryVariables, PaginationOrderBy as PaginationOrderByType, SearchIssuesQueryVariables } from "@linear/sdk/dist/_generated_documents"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { LinearStateName } from "../../../shared/TicketSystem"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const linearStateNameValues = Object.values(LinearStateName)

const DateFilterField = z.enum(["updatedAt", "createdAt"])

export const linearSearchTicketTool = tool({
    name: ToolName.LINEAR_SEARCH_TICKET,
    description: `Searches Linear issues by keyword, state filter, and/or date range filters. Use this before reading individual tickets. Results are ordered by most recently updated first. Use 'after' cursor to paginate.`,
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
        dateFilterField: DateFilterField.nullable()
            .optional()
            .describe("Which date field to filter on. Required if using dateAfter or dateBefore. Options: 'updatedAt' (when issue was last modified) or 'createdAt' (when issue was created)."),
        dateAfter: z
            .string()
            .nullable()
            .optional()
            .describe("Filter to only include issues where the dateFilterField is on or after this date. ISO 8601 format (e.g., '2026-01-01' or '2026-01-01T00:00:00Z')."),
        dateBefore: z
            .string()
            .nullable()
            .optional()
            .describe("Filter to only include issues where the dateFilterField is on or before this date. ISO 8601 format (e.g., '2026-02-01' or '2026-02-01T23:59:59Z')."),
        limit: z.number().nullable().optional().describe("Maximum number of issues to return. Defaults to 10 if not provided."),
        after: z.string().nullable().optional().describe("Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results.")
    }),
    execute: async ({ integrationId, searchTerm, stateNames, dateFilterField, dateAfter, dateBefore, limit = 10, after }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_search_ticket tool", {
            integrationId,
            searchTerm,
            stateNames,
            dateFilterField,
            dateAfter,
            dateBefore,
            limit,
            after
        })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        // Initialize Linear client with OAuth token
        const client = new LinearClient({
            accessToken
        })

        try {
            // Validate date filter parameters
            if ((dateAfter || dateBefore) && !dateFilterField) {
                throw new Error("dateFilterField is required when using dateAfter or dateBefore. Set dateFilterField to 'updatedAt' or 'createdAt' to specify which date field to filter on.")
            }

            // Build filter options - combine state and date filters
            const buildFilter = (): IssueFilter | undefined => {
                const filterParts: IssueFilter = {}

                // Add state filter if provided
                if (stateNames && stateNames.length > 0) {
                    filterParts.state = { name: { in: stateNames } }
                }

                // Add date range filter based on dateFilterField
                if (dateFilterField && (dateAfter || dateBefore)) {
                    const dateFilter: { gte?: Date; lte?: Date } = {}
                    if (dateAfter) {
                        dateFilter.gte = new Date(dateAfter)
                    }
                    if (dateBefore) {
                        dateFilter.lte = new Date(dateBefore)
                    }
                    filterParts[dateFilterField] = dateFilter
                }

                // Return undefined if no filters were added
                return Object.keys(filterParts).length > 0 ? filterParts : undefined
            }

            const filter = buildFilter()

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
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error("❌ Error searching Linear issues", { error: errorMessage, searchTerm })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    },
    errorFunction: formatError
})
