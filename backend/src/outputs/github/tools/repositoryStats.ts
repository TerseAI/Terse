import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { createGitHubClient, getGitHubAccessToken, getRepositoryStats, parseRepoFullName } from "../githubApiClient"

import { validateGitHubRepository } from "./searchCode"

/**
 * Tool for reading a repository's current counters. GitHub reports totals only, so growth over
 * time is computed by the caller from a previously stored reading.
 */
export const getGitHubRepositoryStatsTool = defineSessionTool({
    name: "getGitHubRepositoryStats",
    strict: true,
    execute: async ({ repository }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)

        logger.info("[GitHub KB] getGitHubRepositoryStats - Request", { tool: "getGitHubRepositoryStats", repository, owner, repo })

        try {
            const stats = await getRepositoryStats(client, owner, repo)

            logger.debug("[GitHub KB] getGitHubRepositoryStats - Raw API response", { stars: stats.stars, forks: stats.forks, openIssues: stats.openIssues })

            const response = {
                success: true,
                repository,
                stats: {
                    id: stats.id,
                    fullName: stats.fullName,
                    description: stats.description,
                    stars: stats.stars,
                    forks: stats.forks,
                    watchers: stats.watchers,
                    openIssues: stats.openIssues,
                    defaultBranch: stats.defaultBranch,
                    language: stats.language,
                    topics: stats.topics,
                    license: stats.license,
                    isPrivate: stats.isPrivate,
                    isArchived: stats.isArchived,
                    isFork: stats.isFork,
                    createdAt: stats.createdAt,
                    updatedAt: stats.updatedAt,
                    pushedAt: stats.pushedAt,
                    url: stats.htmlUrl
                },
                message: `${stats.fullName} has ${stats.stars} stars, ${stats.forks} forks, ${stats.watchers} watchers and ${stats.openIssues} open issues (last push ${stats.pushedAt || "unknown"}).`
            }

            logger.info("[GitHub KB] getGitHubRepositoryStats - Response", { success: true, repository, stars: stats.stars })

            const action = {
                action: "Read GitHub repository stats",
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `${stats.stars} stars, ${stats.forks} forks, ${stats.openIssues} open issues`,
                url: stats.htmlUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] getGitHubRepositoryStats - Failed", {
                repository,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(errorMessage)
        }
    }
})

export const validateGetGitHubRepositoryStats: ToolACLValidator<"getGitHubRepositoryStats", GitHubConfig> = ({ args, configs, runContext }) =>
    validateGitHubRepository(args.repository, configs, runContext)
