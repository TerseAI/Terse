import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, listCommits, parseRepoFullName, getGitHubAccessToken } from "../githubApiClient";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { Session } from "../../../server";

/**
 * Tool for listing commits in GitHub repositories within a time window.
 */
export const listGitHubCommitsTool = tool({
    name: 'listGitHubCommits',
    description: `List commits in GitHub repositories within a time window. Use this to:
- Review recent changes and development activity
- Track what code was modified in a specific period
- Find commits by a specific author
- See commit history for a specific file or directory
- Understand the pace and nature of development

The tool returns commit details including message, author, date, and SHA.`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the GitHub knowledge base to use. Required when multiple GitHub knowledge bases are configured.'),
        repository: z.string().describe('Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        since: z.union([z.string(), z.null()]).describe('Start of time window (ISO date string, e.g., "2024-01-01" or "2024-01-15T00:00:00Z"). Only commits after this date are included. Use null for no start filter.'),
        until: z.union([z.string(), z.null()]).describe('End of time window (ISO date string). Only commits before this date are included. Use null for no end filter.'),
        branch: z.union([z.string(), z.null()]).describe('Branch name to list commits from (e.g., "main", "develop"). Use null for the repository\'s default branch.'),
        path: z.union([z.string(), z.null()]).describe('Only include commits that affect this file or directory path (e.g., "src/components" or "package.json"). Use null for all paths.'),
        author: z.union([z.string(), z.null()]).describe('Filter commits by author (GitHub username or email). Use null for all authors.'),
        perPage: z.number().describe('Number of results to return (default: 30, max: 100)'),
    }),
    execute: async ({ integrationId, repository, since, until, branch, path, author, perPage = 30 }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id);
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`);
        }

        const client = createGitHubClient(accessToken);
        const { owner, repo } = parseRepoFullName(repository);

        const requestParams = {
            tool: 'listGitHubCommits',
            repository,
            owner,
            repo,
            since,
            until,
            branch,
            path,
            author,
            perPage: Math.min(perPage || 30, 100),
        };
        logger.info('[GitHub KB] listGitHubCommits - Request', requestParams);
        logger.debug('[GitHub KB] listGitHubCommits - Full request params', { requestParams });

        try {
            const results = await listCommits(client, owner, repo, {
                since: since || undefined,
                until: until || undefined,
                sha: branch || undefined,
                path: path || undefined,
                author: author || undefined,
                perPage: Math.min(perPage || 30, 100),
            });

            logger.debug('[GitHub KB] listGitHubCommits - Raw API response', {
                totalFetched: results.totalFetched,
                items: results.items.map(commit => ({
                    sha: commit.shortSha,
                    message: commit.message.split('\n')[0],
                    author: commit.author,
                    date: commit.date,
                })),
            });

            // Format results for readability
            const formattedResults = results.items.map((commit) => ({
                sha: commit.shortSha,
                fullSha: commit.sha,
                message: commit.message.split('\n')[0], // First line only for summary
                fullMessage: commit.message,
                author: commit.author,
                date: commit.date,
                url: commit.htmlUrl,
            }));

            // Group commits by author for summary
            const authorCounts: Record<string, number> = {};
            formattedResults.forEach(c => {
                authorCounts[c.author] = (authorCounts[c.author] || 0) + 1;
            });

            const timeWindowDesc = since || until 
                ? `${since ? `from ${since}` : ''}${since && until ? ' ' : ''}${until ? `until ${until}` : ''}`
                : 'recent';

            const filterDesc = [
                branch && `branch: ${branch}`,
                path && `path: ${path}`,
                author && `author: ${author}`,
            ].filter(Boolean).join(', ');

            const response = {
                success: true,
                repository,
                timeWindow: timeWindowDesc,
                filters: filterDesc || 'none',
                summary: {
                    total: formattedResults.length,
                    byAuthor: authorCounts,
                },
                commits: formattedResults,
                message: formattedResults.length === 0
                    ? `No commits found for ${repository} ${timeWindowDesc}${filterDesc ? ` (${filterDesc})` : ''}.`
                    : `Found ${formattedResults.length} commits for ${repository} ${timeWindowDesc}.`,
                tip: formattedResults.length > 0 
                    ? 'Use readGitHubFile to see the current state of any files, or searchGitHubCode to find specific code changes.'
                    : 'Try broadening the time window or removing filters.',
            };

            logger.info('[GitHub KB] listGitHubCommits - Response', {
                success: true,
                total: formattedResults.length,
                authorCount: Object.keys(authorCounts).length,
            });
            logger.debug('[GitHub KB] listGitHubCommits - Full response', { response });

            // Return action as part of the result
            const action = {
                action: 'Listed GitHub commits',
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Listed ${formattedResults.length} commit(s)${branch ? ` on branch ${branch}` : ' on default branch'}${timeWindowDesc !== 'recent' ? ` (${timeWindowDesc})` : ''}`,
                url: `https://github.com/${owner}/${repo}/commits/${branch || 'HEAD'}`,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            };

            return {
                ...response,
                actions: [action],
            };
        } catch (error: any) {
            logger.error('[GitHub KB] listGitHubCommits - Failed', { 
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
