import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { createGitHubClient, getGitHubAccessToken, searchIssues } from "../githubApiClient"

import { formatIssue } from "./listIssues"
import { validateGitHubRepositoryNames } from "./searchCode"
import { assertNoSearchQualifiers, quoteQualifierValue } from "./searchSanitize"

/**
 * Tool for searching issues across repositories ranked by engagement (reactions, comments).
 */
export const searchGitHubIssuesTool = defineSessionTool({
    name: "searchGitHubIssues",
    strict: true,
    execute: async ({ repositoryNames, query, state, labels, since, until, sort, order, perPage = 20, page }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        if (repositoryNames.length === 0) {
            throw new Error("No repositories provided. The repositoryNames parameter must contain at least one repository.")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const fullQuery = buildIssueSearchQuery({ repositoryNames, query, state, labels, since, until })
        const normalizedPerPage = Math.min(perPage || 20, 100)
        const pageNumber = Math.max(1, page ?? 1)

        const requestParams = {
            tool: "searchGitHubIssues",
            query: fullQuery,
            originalQuery: query,
            repositories: repositoryNames,
            sort,
            order,
            perPage: normalizedPerPage,
            page: pageNumber
        }
        logger.info("[GitHub KB] searchGitHubIssues - Request", requestParams)
        logger.debug("[GitHub KB] searchGitHubIssues - Full request params", { requestParams })

        try {
            const results = await searchIssues(client, fullQuery, { sort, order, perPage: normalizedPerPage, page: pageNumber })

            logger.debug("[GitHub KB] searchGitHubIssues - Raw API response", {
                totalCount: results.totalCount,
                items: results.items.map(issue => ({ repository: issue.repositoryFullName, number: issue.number, comments: issue.comments, reactions: issue.reactions.total }))
            })

            const formattedResults = results.items.map(issue => ({
                ...formatIssue(issue),
                repository: issue.repositoryFullName
            }))

            const paginationInfo = results.pagination.hasMore
                ? ` Page ${results.pagination.page} (${formattedResults.length} shown). More results available - use page ${results.pagination.page + 1} to see more.`
                : ` Page ${results.pagination.page} (${formattedResults.length} shown).`

            const response = {
                success: true,
                query: fullQuery,
                repositories: repositoryNames,
                totalCount: results.totalCount,
                pagination: results.pagination,
                issues: formattedResults,
                message:
                    results.totalCount === 0
                        ? `No issues matched the search in ${repositoryNames.join(", ")}. Try broadening the query, widening the date range, or removing label filters.`
                        : `Found ${results.totalCount} issues sorted by ${sort} ${order}.${paginationInfo}`
            }

            logger.info("[GitHub KB] searchGitHubIssues - Response", { success: true, totalCount: results.totalCount, returned: formattedResults.length })

            const action = {
                action: "Searched GitHub issues",
                integration: IntegrationType.GITHUB,
                target: repositoryNames.join(", "),
                details: `Issue search sorted by ${sort}: found ${results.totalCount} result(s)${results.pagination.hasMore ? ` (showing page ${results.pagination.page})` : ""}`,
                url: `https://github.com/search?q=${encodeURIComponent(fullQuery)}&type=issues`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] searchGitHubIssues - Failed", {
                query: fullQuery,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(`${errorMessage}. If the search query is too complex, try simplifying it or reducing the number of filters.`)
        }
    }
})

export const validateSearchGitHubIssues: ToolACLValidator<"searchGitHubIssues", GitHubConfig> = ({ args, configs, runContext }) =>
    validateGitHubRepositoryNames(args.repositoryNames, configs, runContext)

type IssueSearchQueryParts = {
    repositoryNames: readonly string[]
    query: string
    state: "open" | "closed" | "all"
    labels: string[] | null
    since: string | null
    until: string | null
}

/**
 * Build the GitHub search query. The repository allowlist is enforced by the `repo:` qualifiers
 * appended here, and GitHub ORs repeated qualifiers, so the agent-supplied free text is rejected
 * outright if it contains any qualifier of its own.
 */
function buildIssueSearchQuery({ repositoryNames, query, state, labels, since, until }: IssueSearchQueryParts): string {
    assertNoSearchQualifiers(query, "query")

    const createdRange = buildCreatedRange(since, until)
    const parts = [
        query.trim(),
        "is:issue",
        state === "all" ? null : `state:${state}`,
        ...(labels ?? []).map(label => `label:${quoteQualifierValue(label)}`),
        createdRange,
        ...repositoryNames.map(repository => `repo:${repository}`)
    ]

    return parts.filter(Boolean).join(" ")
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function buildCreatedRange(since: string | null, until: string | null): string | null {
    const start = assertIsoDate(since, "since")
    const end = assertIsoDate(until, "until")
    if (start && end) return `created:${start}..${end}`
    if (start) return `created:>=${start}`
    if (end) return `created:<=${end}`
    return null
}

function assertIsoDate(value: string | null, fieldName: string): string | null {
    if (!value) return null
    const trimmed = value.trim()
    if (!ISO_DATE_PATTERN.test(trimmed)) {
        throw new Error(`Invalid \`${fieldName}\` argument: expected a date in YYYY-MM-DD format, got "${value}".`)
    }
    return trimmed
}
