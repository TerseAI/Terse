import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, listPullRequests, parseRepoFullName } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";

/**
 * Tool for listing pull requests in GitHub repositories within a time window.
 */
export const listGitHubPullRequestsTool = tool({
    name: 'listGitHubPullRequests',
    description: `List pull requests in GitHub repositories within a time window. Use this to:
- Find recently merged PRs to understand recent changes
- Review what work has been completed in a given period
- Track PR activity for specific repositories
- Understand the development history and velocity

The tool returns PR details including title, author, merge status, and dates.`,
    parameters: z.object({
        repository: z.string().describe('Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        state: z.enum(['open', 'closed', 'all']).describe('Filter by PR state. Use "closed" to see merged PRs, "open" for in-progress, or "all" for both.'),
        since: z.union([z.string(), z.null()]).describe('Start of time window (ISO date string, e.g., "2024-01-01" or "2024-01-15T00:00:00Z"). Only PRs updated after this date are included. Use null for no start filter.'),
        until: z.union([z.string(), z.null()]).describe('End of time window (ISO date string). Only PRs updated before this date are included. Use null for no end filter.'),
        perPage: z.number().describe('Number of results to return (default: 20, max: 100)'),
    }),
    execute: async ({ repository, state, since, until, perPage = 20 }, runContext?: RunContext<any>) => {
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
                tip: `Use one of the configured repositories: ${githubKBConfig.repositoryNames.join(', ')}`,
            };
        }

        const client = createGitHubClient(accessToken);
        const { owner, repo } = parseRepoFullName(repository);

        const requestParams = {
            tool: 'listGitHubPullRequests',
            repository,
            owner,
            repo,
            state,
            since,
            until,
            perPage: Math.min(perPage || 20, 100),
        };
        logger.info('[GitHub KB] listGitHubPullRequests - Request', requestParams);
        logger.debug('[GitHub KB] listGitHubPullRequests - Full request params', { requestParams });

        try {
            const results = await listPullRequests(client, owner, repo, {
                state,
                since: since || undefined,
                until: until || undefined,
                perPage: Math.min(perPage || 20, 100),
            });

            logger.debug('[GitHub KB] listGitHubPullRequests - Raw API response', {
                totalFetched: results.totalFetched,
                items: results.items.map(pr => ({
                    number: pr.number,
                    title: pr.title,
                    state: pr.state,
                    merged: pr.merged,
                    author: pr.author,
                })),
            });

            // Format results for readability
            const formattedResults = results.items.map((pr) => ({
                number: pr.number,
                title: pr.title,
                author: pr.author,
                state: pr.state,
                merged: pr.merged,
                mergedAt: pr.mergedAt,
                createdAt: pr.createdAt,
                closedAt: pr.closedAt,
                labels: pr.labels,
                baseBranch: pr.baseBranch,
                headBranch: pr.headBranch,
                url: pr.htmlUrl,
            }));

            const mergedCount = formattedResults.filter(pr => pr.merged).length;
            const openCount = formattedResults.filter(pr => pr.state === 'open').length;

            const timeWindowDesc = since || until 
                ? `${since ? `from ${since}` : ''}${since && until ? ' ' : ''}${until ? `until ${until}` : ''}`
                : 'all time';

            const response = {
                success: true,
                repository,
                timeWindow: timeWindowDesc,
                summary: {
                    total: formattedResults.length,
                    merged: mergedCount,
                    open: openCount,
                    closed: formattedResults.length - openCount,
                },
                pullRequests: formattedResults,
                message: formattedResults.length === 0
                    ? `No pull requests found for ${repository} ${timeWindowDesc}.`
                    : `Found ${formattedResults.length} pull requests (${mergedCount} merged, ${openCount} open) for ${repository} ${timeWindowDesc}.`,
            };

            logger.info('[GitHub KB] listGitHubPullRequests - Response', {
                success: true,
                total: formattedResults.length,
                merged: mergedCount,
                open: openCount,
            });
            logger.debug('[GitHub KB] listGitHubPullRequests - Full response', { response });

            return response;
        } catch (error: any) {
            logger.error('[GitHub KB] listGitHubPullRequests - Failed', { 
                repository, 
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                error: error.message,
                repository,
                tip: 'If you\'re getting rate limit errors, try reducing perPage or narrowing the time window.',
            };
        }
    },
});
