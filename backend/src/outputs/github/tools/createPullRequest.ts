import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"
import { createGitHubClient, createPullRequest, getGitHubAccessToken, parseRepoFullName } from "../githubApiClient"

export const createGitHubPullRequestTool = defineSessionTool({
    name: "createGitHubPullRequest",
    description: `Create a pull request in a GitHub repository. Use this to:
- Open a new pull request to propose changes from one branch to another
- Create PRs for documentation updates, README changes, or other modifications
- Submit code changes for review

The tool creates a PR from a head branch (source) into a base branch (target).
You must specify the repository, title, head branch, and base branch. The head branch must already exist and contain commits not present in the base branch.

You can optionally:
- Provide a description/body in Markdown format
- Create the PR as a draft`,
    strict: true,
    execute: async ({ repository, title, body, head, base, draft }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id)
        if (!accessToken) {
            throw new Error("GitHub access token not found for user")
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)

        const requestParams = {
            tool: "createGitHubPullRequest",
            repository,
            owner,
            repo,
            title,
            head,
            base,
            draft: draft ?? false
        }
        logger.info("[GitHub KB] createGitHubPullRequest - Request", requestParams)

        try {
            const result = await createPullRequest(client, owner, repo, {
                title,
                body: body ?? undefined,
                head,
                base,
                draft: draft ?? false
            })

            const response = {
                success: true as const,
                repository,
                pullRequest: {
                    number: result.number,
                    title: result.title,
                    state: result.state,
                    merged: result.merged,
                    draft: result.draft,
                    baseBranch: result.baseBranch,
                    headBranch: result.headBranch,
                    url: result.htmlUrl
                },
                message: `Created pull request #${result.number}: "${result.title}" (${result.headBranch} → ${result.baseBranch})${result.draft ? " [draft]" : ""}`
            }

            logger.info("[GitHub KB] createGitHubPullRequest - Response", {
                success: true,
                pullNumber: result.number,
                title: result.title,
                draft: result.draft
            })

            const action = {
                action: "Created GitHub pull request",
                integration: IntegrationType.GITHUB,
                target: `${owner}/${repo}`,
                details: `Created PR #${result.number}: "${result.title}" (${result.headBranch} → ${result.baseBranch})`,
                url: result.htmlUrl,
                type: RunHistoryActionType.create,
                isReadOnly: false
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = extractErrorMessage(error)
            logger.error("[GitHub KB] createGitHubPullRequest - Failed", {
                repository,
                head,
                base,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new Error(`${errorMessage}. Verify that the head branch exists, has commits ahead of the base branch, and no duplicate PR exists.`)
        }
    }
})
