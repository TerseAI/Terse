import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { createGitHubClient, getGitHubAccessToken, listCommits, parseRepoFullName } from "../githubApiClient"

import { validateGitHubRepository } from "./searchCode"

/**
 * Tool for listing commits in GitHub repositories within a time window.
 */
export const listGitHubCommitsTool = defineSessionTool({
    name: "listGitHubCommits",
    strict: true,
    execute: async ({ repository, since, until, branch, path, author, perPage = 30 }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)

        const requestParams = {
            tool: "listGitHubCommits",
            repository,
            owner,
            repo,
            since,
            until,
            branch,
            path,
            author,
            perPage: Math.min(perPage || 30, 100)
        }
        logger.info("[GitHub KB] listGitHubCommits - Request", requestParams)
        logger.debug("[GitHub KB] listGitHubCommits - Full request params", { requestParams })

        try {
            const results = await listCommits(client, owner, repo, {
                since: since || undefined,
                until: until || undefined,
                sha: branch || undefined,
                path: path || undefined,
                author: author || undefined,
                perPage: Math.min(perPage || 30, 100)
            })

            logger.debug("[GitHub KB] listGitHubCommits - Raw API response", {
                totalFetched: results.totalFetched,
                items: results.items.map(commit => ({
                    sha: commit.shortSha,
                    message: commit.message.split("\n")[0],
                    author: commit.author,
                    date: commit.date
                }))
            })

            // Format results for readability
            const formattedResults = results.items.map(commit => ({
                sha: commit.shortSha,
                fullSha: commit.sha,
                message: commit.message.split("\n")[0], // First line only for summary
                fullMessage: commit.message,
                author: commit.author,
                date: commit.date,
                url: commit.htmlUrl
            }))

            // Group commits by author for summary
            const authorCounts: Record<string, number> = {}
            formattedResults.forEach(c => {
                authorCounts[c.author] = (authorCounts[c.author] || 0) + 1
            })

            const timeWindowDesc = since || until ? `${since ? `from ${since}` : ""}${since && until ? " " : ""}${until ? `until ${until}` : ""}` : "recent"

            const filterDesc = [branch && `branch: ${branch}`, path && `path: ${path}`, author && `author: ${author}`].filter(Boolean).join(", ")

            const response = {
                success: true,
                repository,
                timeWindow: timeWindowDesc,
                filters: filterDesc || "none",
                summary: {
                    total: formattedResults.length,
                    byAuthor: authorCounts
                },
                commits: formattedResults,
                message:
                    formattedResults.length === 0
                        ? `No commits found for ${repository} ${timeWindowDesc}${filterDesc ? ` (${filterDesc})` : ""}.`
                        : `Found ${formattedResults.length} commits for ${repository} ${timeWindowDesc}.`,
                tip:
                    formattedResults.length > 0
                        ? "Use readGitHubFile to see the current state of any files, or searchGitHubCode to find specific code changes."
                        : "Try broadening the time window or removing filters."
            }

            logger.info("[GitHub KB] listGitHubCommits - Response", {
                success: true,
                total: formattedResults.length,
                authorCount: Object.keys(authorCounts).length
            })

            // Return action as part of the result
            const action = {
                action: "Listed GitHub commits",
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Listed ${formattedResults.length} commit(s)${branch ? ` on branch ${branch}` : " on default branch"}${timeWindowDesc !== "recent" ? ` (${timeWindowDesc})` : ""}`,
                url: `https://github.com/${owner}/${repo}/commits/${branch || "HEAD"}`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] listGitHubCommits - Failed", {
                repository,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(`${errorMessage}. If you're getting rate limit errors, try reducing perPage or narrowing the time window.`)
        }
    }
})

export const validateListGitHubCommits: ToolACLValidator<"listGitHubCommits", GitHubConfig> = ({ args, configs, runContext }) => validateGitHubRepository(args.repository, configs, runContext)
