import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { IssueInfo, createGitHubClient, getGitHubAccessToken, listIssues, parseRepoFullName } from "../githubApiClient"

import { validateGitHubRepository } from "./searchCode"

/**
 * Tool for listing issues in a GitHub repository, optionally ranked by comment count.
 */
export const listGitHubIssuesTool = defineSessionTool({
    name: "listGitHubIssues",
    strict: true,
    execute: async ({ repository, state, labels, since, sort, direction, creator, assignee, perPage = 30, page }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)
        const normalizedPerPage = Math.min(perPage || 30, 100)
        const pageNumber = Math.max(1, page ?? 1)

        const requestParams = {
            tool: "listGitHubIssues",
            repository,
            owner,
            repo,
            state,
            labels,
            since,
            sort,
            direction,
            creator,
            assignee,
            perPage: normalizedPerPage,
            page: pageNumber
        }
        logger.info("[GitHub KB] listGitHubIssues - Request", requestParams)
        logger.debug("[GitHub KB] listGitHubIssues - Full request params", { requestParams })

        try {
            const results = await listIssues(client, owner, repo, {
                state,
                labels: labels ?? undefined,
                since: since ?? undefined,
                sort,
                direction,
                creator: creator ?? undefined,
                assignee: assignee ?? undefined,
                perPage: normalizedPerPage,
                page: pageNumber
            })

            logger.debug("[GitHub KB] listGitHubIssues - Raw API response", {
                count: results.items.length,
                items: results.items.map(issue => ({ number: issue.number, title: issue.title, state: issue.state, comments: issue.comments }))
            })

            const formattedResults = results.items.map(formatIssue)
            const summary = calculateIssueSummary(formattedResults)
            const timeWindowDesc = since ? `updated since ${since}` : "all time"
            const filterDesc = describeFilters({ labels, creator, assignee })
            const paginationInfo = results.pagination.hasMore
                ? ` Page ${results.pagination.page} (${formattedResults.length} issues shown). More issues available - use page ${results.pagination.page + 1} to see more.`
                : ` Page ${results.pagination.page} (${formattedResults.length} issues shown).`

            const response = {
                success: true,
                repository,
                timeWindow: timeWindowDesc,
                filters: filterDesc,
                summary,
                pagination: results.pagination,
                issues: formattedResults,
                message:
                    formattedResults.length === 0
                        ? `No issues found for ${repository} (${timeWindowDesc}${filterDesc === "none" ? "" : `, ${filterDesc}`}).`
                        : `Found ${summary.total} issues (${summary.open} open, ${summary.closed} closed) for ${repository} sorted by ${sort} ${direction}.${paginationInfo}`
            }

            logger.info("[GitHub KB] listGitHubIssues - Response", { success: true, total: summary.total, open: summary.open })

            const action = {
                action: "Listed GitHub issues",
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Listed ${formattedResults.length} issue(s) with state: ${state}${filterDesc === "none" ? "" : ` (${filterDesc})`}${results.pagination.hasMore ? " (more available)" : ""}`,
                url: `https://github.com/${owner}/${repo}/issues?q=${encodeURIComponent(`is:issue state:${state}`)}`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] listGitHubIssues - Failed", {
                repository,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(`${errorMessage}. If you're getting rate limit errors, try reducing perPage or narrowing the filters.`)
        }
    }
})

export const validateListGitHubIssues: ToolACLValidator<"listGitHubIssues", GitHubConfig> = ({ args, configs, runContext }) => validateGitHubRepository(args.repository, configs, runContext)

export function formatIssue(issue: IssueInfo) {
    return {
        number: issue.number,
        title: issue.title,
        description: issue.body ?? "",
        author: issue.author,
        state: issue.state,
        labels: issue.labels,
        assignees: issue.assignees,
        comments: issue.comments,
        reactions: issue.reactions,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        closedAt: issue.closedAt ?? undefined,
        url: issue.htmlUrl
    }
}

export function calculateIssueSummary(issues: Array<{ state: string }>) {
    const openCount = issues.filter(issue => issue.state === "open").length
    return {
        total: issues.length,
        open: openCount,
        closed: issues.length - openCount
    }
}

function describeFilters({ labels, creator, assignee }: { labels: string[] | null; creator: string | null; assignee: string | null }): string {
    const parts = [labels?.length ? `labels: ${labels.join(", ")}` : null, creator ? `creator: ${creator}` : null, assignee ? `assignee: ${assignee}` : null].filter(Boolean)
    return parts.length ? parts.join(", ") : "none"
}
