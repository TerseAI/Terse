import { LinearClient } from "@linear/sdk"
import type { IssueFilter, IssuesQueryVariables, PaginationOrderBy as PaginationOrderByType, SearchIssuesQueryVariables } from "@linear/sdk/dist/_generated_documents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { getLinearAccessTokenForOrganization } from "../../../integrations/linear/integration"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

export const linearSearchTicketTool = defineSessionTool({
    name: "linear_search_ticket",
    execute: async ({ integrationId, searchTerm, stateNames, dateFilterField, dateAfter, dateBefore, limit = 10, after }, runContext) => {
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
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error searching Linear issues", { error: errorMessage, searchTerm })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
})
