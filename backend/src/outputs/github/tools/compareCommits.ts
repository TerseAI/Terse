import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { compareCommits, createGitHubClient, getGitHubAccessToken, parseRepoFullName } from "../githubApiClient"

import { validateGitHubRepository } from "./searchCode"

/**
 * Tool for comparing two refs (branches, tags, or SHAs) in a single call — the cheap way to
 * answer "what changed between these two releases".
 */
export const compareGitHubCommitsTool = defineSessionTool({
    name: "compareGitHubCommits",
    strict: true,
    execute: async ({ repository, base, head, perPage = 50, page }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)
        const normalizedPerPage = Math.min(perPage || 50, 250)
        const pageNumber = Math.max(1, page ?? 1)

        const requestParams = {
            tool: "compareGitHubCommits",
            repository,
            owner,
            repo,
            base,
            head,
            perPage: normalizedPerPage,
            page: pageNumber
        }
        logger.info("[GitHub KB] compareGitHubCommits - Request", requestParams)
        logger.debug("[GitHub KB] compareGitHubCommits - Full request params", { requestParams })

        try {
            const comparison = await compareCommits(client, owner, repo, base, head, { perPage: normalizedPerPage, page: pageNumber })

            logger.debug("[GitHub KB] compareGitHubCommits - Raw API response", {
                status: comparison.status,
                aheadBy: comparison.aheadBy,
                behindBy: comparison.behindBy,
                totalCommits: comparison.totalCommits,
                filesReturned: comparison.files.length
            })

            const formattedCommits = comparison.commits.map(commit => ({
                sha: commit.shortSha,
                fullSha: commit.sha,
                message: commit.message.split("\n")[0],
                fullMessage: commit.message,
                author: commit.author,
                date: commit.date,
                url: commit.htmlUrl
            }))

            const paginationInfo = comparison.pagination.hasMore
                ? ` Page ${comparison.pagination.page} (${formattedCommits.length} of ${comparison.totalCommits} commits shown). Use page ${comparison.pagination.page + 1} for more.`
                : ` Page ${comparison.pagination.page} (${formattedCommits.length} commits shown).`

            const response = {
                success: true,
                repository,
                base,
                head,
                summary: {
                    status: comparison.status,
                    aheadBy: comparison.aheadBy,
                    behindBy: comparison.behindBy,
                    totalCommits: comparison.totalCommits,
                    additions: comparison.additions,
                    deletions: comparison.deletions,
                    filesChanged: comparison.files.length
                },
                pagination: comparison.pagination,
                commits: formattedCommits,
                files: comparison.files,
                message: `${head} is ${comparison.status} ${base}: ${comparison.aheadBy} commit(s) ahead, ${comparison.behindBy} behind, across ${comparison.files.length} changed file(s) (+${comparison.additions}/-${comparison.deletions}).${paginationInfo}`
            }

            logger.info("[GitHub KB] compareGitHubCommits - Response", {
                success: true,
                status: comparison.status,
                totalCommits: comparison.totalCommits,
                filesChanged: comparison.files.length
            })

            const action = {
                action: "Compared GitHub commits",
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Compared ${base}...${head}: ${comparison.totalCommits} commit(s), ${comparison.files.length} file(s) changed`,
                url: comparison.htmlUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] compareGitHubCommits - Failed", {
                repository,
                base,
                head,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(`${errorMessage}. Both base and head must be an existing branch, tag, or commit SHA in this repository.`)
        }
    }
})

export const validateCompareGitHubCommits: ToolACLValidator<"compareGitHubCommits", GitHubConfig> = ({ args, configs, runContext }) => validateGitHubRepository(args.repository, configs, runContext)
