import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, getPullRequestDiff, parseRepoFullName } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";

/**
 * Tool for reading the diff of a pull request from GitHub repositories.
 * Returns the unified diff showing all changes in the PR.
 */
export const readGitHubPullRequestDiffTool = tool({
    name: 'readGitHubPullRequestDiff',
    description: `Read the diff of a pull request from a GitHub repository. Use this to:
- Understand what changes were made in a specific PR
- Review code changes before merging
- Analyze the impact of a PR on the codebase
- See file-by-file changes with additions and deletions

The tool returns:
- A unified diff string showing all changes with specific line additions (+) and deletions (-)
- Per-file patches with detailed changes for each file
- Summary statistics for each file

This gives you the exact string changes - what was removed, what was added, and the surrounding context.`,
    parameters: z.object({
        repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        pullNumber: z.number().describe('The pull request number (e.g., 123 for PR #123)'),
    }),
    execute: async ({ repository, pullNumber }, runContext?: RunContext<any>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const githubKBConfig = runContext.context.githubKBConfig as GitHubKBConfig | undefined;
        if (!githubKBConfig) {
            throw new Error("GitHub KB config not found in context. Ensure GitHub is configured as a knowledge base.");
        }

        const accessToken = runContext.context.githubAccessToken as string | undefined;
        if (!accessToken) {
            throw new Error("GitHub access token not found in context.");
        }

        // Validate that the repository is in the configured list
        if (!githubKBConfig.repositoryNames.includes(repository)) {
            return {
                success: false,
                error: `Repository "${repository}" is not configured for this knowledge base.`,
                configuredRepositories: githubKBConfig.repositoryNames,
                tip: 'Use one of the configured repositories listed above.',
            };
        }

        const client = createGitHubClient(accessToken);
        const { owner, repo } = parseRepoFullName(repository);

        const requestParams = {
            tool: 'readGitHubPullRequestDiff',
            repository,
            owner,
            repo,
            pullNumber,
        };
        logger.info('[GitHub KB] readGitHubPullRequestDiff - Request', requestParams);
        logger.debug('[GitHub KB] readGitHubPullRequestDiff - Full request params', { requestParams });

        try {
            const prDiff = await getPullRequestDiff(client, owner, repo, pullNumber);

            logger.debug('[GitHub KB] readGitHubPullRequestDiff - Raw API response', {
                number: prDiff.number,
                title: prDiff.title,
                state: prDiff.state,
                merged: prDiff.merged,
                filesChanged: prDiff.filesChanged.length,
                additions: prDiff.additions,
                deletions: prDiff.deletions,
                diffLength: prDiff.diff.length,
            });

            // Format the response
            const response = {
                success: true,
                repository,
                pullRequest: {
                    number: prDiff.number,
                    title: prDiff.title,
                    state: prDiff.state,
                    merged: prDiff.merged,
                    baseBranch: prDiff.baseBranch,
                    headBranch: prDiff.headBranch,
                    url: prDiff.htmlUrl,
                },
                summary: {
                    filesChanged: prDiff.filesChanged.length,
                    additions: prDiff.additions,
                    deletions: prDiff.deletions,
                    totalChanges: prDiff.totalChanges,
                },
                files: prDiff.filesChanged.map((file) => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    changes: file.changes,
                    patch: file.patch, // Per-file diff showing specific line changes
                })),
                diff: prDiff.diff, // Full unified diff with all changes across all files
                message: `Retrieved diff for PR #${prDiff.number}: "${prDiff.title}". ${prDiff.filesChanged.length} file(s) changed (${prDiff.additions} additions, ${prDiff.deletions} deletions).`,
            };

            logger.info('[GitHub KB] readGitHubPullRequestDiff - Response', {
                success: true,
                pullNumber: prDiff.number,
                filesChanged: prDiff.filesChanged.length,
                additions: prDiff.additions,
                deletions: prDiff.deletions,
            });
            logger.debug('[GitHub KB] readGitHubPullRequestDiff - Full response (excluding diff)', {
                ...response,
                diff: `[${prDiff.diff.length} chars]`,
            });

            return response;
        } catch (error: any) {
            logger.error('[GitHub KB] readGitHubPullRequestDiff - Failed', { 
                repository, 
                pullNumber,
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                error: error.message,
                repository,
                pullNumber,
                tip: error.message.includes('not found')
                    ? 'Check that the PR number is correct. Use listGitHubPullRequests to find available PRs.'
                    : 'Verify the repository name and PR number are correct.',
            };
        }
    },
});
