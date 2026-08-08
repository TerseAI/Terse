import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { DiscussionInfo, createGitHubClient, getGitHubAccessToken, listDiscussions, parseRepoFullName } from "../githubApiClient"

import { validateGitHubRepository } from "./searchCode"

/**
 * Tool for listing GitHub Discussions, which have no REST endpoint and are read over GraphQL.
 */
export const listGitHubDiscussionsTool = defineSessionTool({
    name: "listGitHubDiscussions",
    strict: true,
    execute: async ({ repository, category, orderBy, direction, answered, perPage = 20, cursor }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)
        const normalizedPerPage = Math.min(perPage || 20, 100)

        const requestParams = {
            tool: "listGitHubDiscussions",
            repository,
            owner,
            repo,
            category,
            orderBy,
            direction,
            answered,
            perPage: normalizedPerPage,
            hasCursor: !!cursor
        }
        logger.info("[GitHub KB] listGitHubDiscussions - Request", requestParams)
        logger.debug("[GitHub KB] listGitHubDiscussions - Full request params", { requestParams })

        try {
            const results = await listDiscussions(client, owner, repo, {
                category: category ?? undefined,
                orderBy,
                direction,
                perPage: normalizedPerPage,
                cursor: cursor ?? undefined
            })

            logger.debug("[GitHub KB] listGitHubDiscussions - Raw API response", {
                count: results.items.length,
                items: results.items.map(discussion => ({ number: discussion.number, title: discussion.title, category: discussion.category, upvotes: discussion.upvotes }))
            })

            // GitHub's discussions connection has no answered filter, so it is applied here.
            const filtered = answered === null || answered === undefined ? results.items : results.items.filter(discussion => discussion.isAnswered === answered)
            const formattedResults = filtered.map(formatDiscussion)
            const paginationInfo = results.pagination.hasMore ? ` More discussions available - pass cursor "${results.pagination.endCursor}" to see the next page.` : " No further pages."

            const response = {
                success: true,
                repository,
                category: category ?? "all",
                categories: results.categories,
                pagination: results.pagination,
                discussions: formattedResults,
                message:
                    formattedResults.length === 0
                        ? `No discussions found for ${repository}${category ? ` in category "${category}"` : ""}. Available categories: ${results.categories.map(c => c.name).join(", ") || "(none)"}.`
                        : `Found ${formattedResults.length} discussions for ${repository}${category ? ` in category "${category}"` : ""}, ordered by ${orderBy} ${direction}.${paginationInfo}`
            }

            logger.info("[GitHub KB] listGitHubDiscussions - Response", { success: true, count: formattedResults.length, hasMore: results.pagination.hasMore })

            const action = {
                action: "Listed GitHub discussions",
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Listed ${formattedResults.length} discussion(s)${category ? ` in category ${category}` : ""}${results.pagination.hasMore ? " (more available)" : ""}`,
                url: `https://github.com/${owner}/${repo}/discussions`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] listGitHubDiscussions - Failed", {
                repository,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(`${errorMessage}. Discussions must be enabled on the repository, and the category filter must match a category name or slug.`)
        }
    }
})

export const validateListGitHubDiscussions: ToolACLValidator<"listGitHubDiscussions", GitHubConfig> = ({ args, configs, runContext }) => validateGitHubRepository(args.repository, configs, runContext)

function formatDiscussion(discussion: DiscussionInfo) {
    return {
        number: discussion.number,
        title: discussion.title,
        body: discussion.body,
        author: discussion.author,
        category: discussion.category,
        upvotes: discussion.upvotes,
        comments: discussion.comments,
        isAnswered: discussion.isAnswered,
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        url: discussion.htmlUrl
    }
}
