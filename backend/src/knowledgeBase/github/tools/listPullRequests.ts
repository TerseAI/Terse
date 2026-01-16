import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, listPullRequests, parseRepoFullName } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { GitHubKnowledgeBaseSession } from "../GitHubKnowledgeBase";

// Helper functions
const normalizePerPage = (perPage?: number): number => Math.min(perPage || 20, 100);

const validateContext = (runContext: RunContext<SessionWithTracking<GitHubKnowledgeBaseSession>>) => {
    const { githubKBConfig, githubAccessToken } = runContext.context;
    return { githubKBConfig, githubAccessToken };
};

const validateRepository = (repository: string, repositoryNames: string[]) => {
    if (!repositoryNames.includes(repository)) {
        return {
            success: false,
            error: `Repository "${repository}" is not configured for this knowledge base.`,
            configuredRepositories: repositoryNames,
            tip: `Use one of the configured repositories: ${repositoryNames.join(', ')}`,
        };
    }
    return null;
};

const formatTimeWindow = (since: string | null, until: string | null): string => {
    if (!since && !until) return 'all time';
    const parts: string[] = [];
    if (since) parts.push(`from ${since}`);
    if (until) parts.push(`until ${until}`);
    return parts.join(' ');
};

const calculateSummary = (prs: Array<{ merged: boolean; state: string }>) => {
    const mergedCount = prs.filter(pr => pr.merged).length;
    const openCount = prs.filter(pr => pr.state === 'open').length;
    return {
        total: prs.length,
        merged: mergedCount,
        open: openCount,
        closed: prs.length - openCount,
    };
};

export const listGitHubPullRequestsTool = tool({
    name: 'listGitHubPullRequests',
    description: `List pull requests in GitHub repositories within a time window. Use this to:
- Find recently merged PRs to understand recent changes
- Review what work has been completed in a given period
- Track PR activity for specific repositories
- Understand the development history and velocity

The tool returns PR details including title, author, merge status, and dates.
Dates are specified in YYYY-MM-DD format (e.g., "2024-01-15"). The since date is interpreted as the start of that day (00:00:00), and the until date is interpreted as the end of that day (23:59:59).`,
    parameters: z.object({
        repository: z.string().describe('Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        state: z.enum(['open', 'closed', 'all']).describe('Filter by PR state. Use "closed" to see merged PRs, "open" for in-progress, or "all" for both.'),
        since: z.union([z.string(), z.null()]).describe('Start date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or after this date (starting at 00:00:00) are included. Use null for no start filter.'),
        until: z.union([z.string(), z.null()]).describe('End date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or before this date (ending at 23:59:59) are included. Use null for no end filter.'),
        perPage: z.number().describe('Number of results to return (default: 20, max: 100)'),
        page: z.union([z.number().int().min(1), z.null()]).describe('Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.'),
    }),
    execute: async ({ repository, state, since, until, perPage = 20, page }, runContext?: RunContext<SessionWithTracking<GitHubKnowledgeBaseSession>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }
        const { githubKBConfig, githubAccessToken } = validateContext(runContext);

        const repoValidationError = validateRepository(repository, githubKBConfig.repositoryNames);
        if (repoValidationError) {
            return repoValidationError;
        }

        const client = createGitHubClient(githubAccessToken);
        const { owner, repo } = parseRepoFullName(repository);
        const normalizedPerPage = normalizePerPage(perPage);
        const pageNumber = Math.max(1, page ?? 1);

        const requestParams = {
            tool: 'listGitHubPullRequests',
            repository,
            owner,
            repo,
            state,
            since,
            until,
            perPage: normalizedPerPage,
            page: pageNumber,
        };
        logger.info('[GitHub KB] listGitHubPullRequests - Request', requestParams);
        logger.debug('[GitHub KB] listGitHubPullRequests - Full request params', { requestParams });

        try {
            const results = await listPullRequests(client, owner, repo, {
                state,
                since: since || undefined,
                until: until || undefined,
                perPage: normalizedPerPage,
                page: pageNumber,
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

            const summary = calculateSummary(formattedResults);
            const timeWindowDesc = formatTimeWindow(since, until);
            const paginationInfo = results.pagination.hasMore
                ? ` Page ${results.pagination.page} (${formattedResults.length} PRs shown). More PRs available - use page ${results.pagination.page + 1} to see more.`
                : ` Page ${results.pagination.page} (${formattedResults.length} PRs shown).`;

            const response = {
                success: true,
                repository,
                timeWindow: timeWindowDesc,
                summary,
                pagination: {
                    page: results.pagination.page,
                    perPage: results.pagination.perPage,
                    hasMore: results.pagination.hasMore,
                },
                pullRequests: formattedResults,
                message: formattedResults.length === 0
                    ? `No pull requests found for ${repository} ${timeWindowDesc}.`
                    : `Found ${summary.total} pull requests (${summary.merged} merged, ${summary.open} open) for ${repository} ${timeWindowDesc}.${paginationInfo}`,
            };

            logger.info('[GitHub KB] listGitHubPullRequests - Response', {
                success: true,
                total: summary.total,
                merged: summary.merged,
                open: summary.open,
            });
            logger.debug('[GitHub KB] listGitHubPullRequests - Full response', { response });

            // Track the action
            runContext.context.trackAction({
                action: 'Listed GitHub pull requests',
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Listed ${formattedResults.length} PR(s)${state ? ` with state: ${state}` : ''}${results.pagination.hasMore ? ' (more available)' : ''}`,
                url: `https://github.com/${owner}/${repo}/pulls${state ? `?state=${state}` : ''}`,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

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
