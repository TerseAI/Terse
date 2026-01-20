import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, searchCode, getGitHubAccessTokenByIntegrationId } from "../githubApiClient";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { Session } from "../../../server";

/**
 * Tool for semantic code search in GitHub repositories.
 * Uses GitHub's Code Search API to find code by meaning, function names, classes, etc.
 */
export const searchGitHubCodeTool = tool({
    name: 'searchGitHubCode',
    description: `Search GitHub repositories for code by SEMANTIC MEANING (conceptual search). Use this when you DON'T know the exact code text.

Use searchGitHubCode for:
- Concepts and patterns: "authentication", "error handling", "database connections"
- Unknown implementations: "how is validation done?", "where are API routes?"
- Exploring codebases: "logging implementations", "payment processing"
- Finding code by what it DOES, not what it's CALLED

Use grepGitHubCode instead when you KNOW the exact text string (function name, import, etc.)

Examples:
- ✅ "authentication middleware" (finds login, auth, verifyToken, etc.)
- ✅ "error handling patterns" (finds try/catch, error handlers, etc.)
- ✅ "database queries" (finds prisma, mysql, query builders)
- ❌ "getUserById(" → Use grepGitHubCode for exact matches

Tips:
- Start with broad searches, then narrow down
- Use natural language or domain terms
- Combine multiple terms for more specific results`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the GitHub knowledge base to use. Required when multiple GitHub knowledge bases are configured.'),
        repositoryNames: z.array(z.string()).describe('Array of repository full names (owner/repo format) to search in.'),
        query: z.string().describe('The search query. Use natural language or code-specific terms. Examples: "authentication middleware", "class UserRepository", "handleSubmit form validation"'),
        language: z.union([z.string(), z.null()]).describe('Filter by programming language (e.g., "typescript", "python", "javascript"). Use null to search all languages.'),
        filename: z.union([z.string(), z.null()]).describe('Filter by filename pattern (e.g., "*.test.ts" for test files, "*.config.*" for config files). Use null to search all files.'),
        path: z.union([z.string(), z.null()]).describe('Filter by path (e.g., "src/components" to only search in that directory). Use null to search everywhere.'),
        perPage: z.number().describe('Number of results to return (default: 10, max: 100)'),
        page: z.union([z.number().int().min(1), z.null()]).describe('Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.'),
    }),
    execute: async ({ integrationId, repositoryNames, query, language, filename, path, perPage = 10, page }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (repositoryNames.length === 0) {
            throw new Error("No repositories provided. The repositoryNames parameter must contain at least one repository.");
        }

        const accessToken = await getGitHubAccessTokenByIntegrationId(integrationId, runContext.context.user.id);
        if (!accessToken) {
            throw new Error(`GitHub integration not found or access denied for integrationId: ${integrationId}`);
        }

        const client = createGitHubClient(accessToken);

        // Build enhanced query with optional filters
        let enhancedQuery = query;
        if (language) {
            enhancedQuery += ` language:${language}`;
        }
        if (filename) {
            enhancedQuery += ` filename:${filename}`;
        }
        if (path) {
            enhancedQuery += ` path:${path}`;
        }

        const pageNumber = Math.max(1, page ?? 1);
        const normalizedPerPage = Math.min(perPage || 10, 100);
        const requestParams = {
            tool: 'searchGitHubCode',
            query: enhancedQuery,
            originalQuery: query,
            filters: { language, filename, path },
            repositories: repositoryNames,
            perPage: normalizedPerPage,
            page: pageNumber,
        };
        logger.info('[GitHub KB] searchGitHubCode - Request', requestParams);
        logger.debug('[GitHub KB] searchGitHubCode - Full request params', { requestParams });

        try {
            const results = await searchCode(
                client,
                enhancedQuery,
                repositoryNames,
                { perPage: normalizedPerPage, page: pageNumber }
            );

            logger.debug('[GitHub KB] searchGitHubCode - Raw API response', {
                totalCount: results.totalCount,
                itemCount: results.items.length,
                items: results.items.map(item => ({
                    path: item.path,
                    repository: item.repository.fullName,
                    sha: item.sha,
                    textMatchCount: item.textMatches?.length || 0,
                })),
            });

            // Format results with snippets
            const formattedResults = results.items.map((item, index) => {
                const snippets = item.textMatches?.map(match => match.fragment).join('\n---\n') || '(no preview available)';
                
                return {
                    index: index + 1,
                    repository: item.repository.fullName,
                    path: item.path,
                    url: item.htmlUrl,
                    snippets,
                };
            });

            const paginationInfo = results.pagination.hasMore
                ? ` Page ${results.pagination.page} (${formattedResults.length} results shown). More results available - use page ${results.pagination.page + 1} to see more.`
                : ` Page ${results.pagination.page} (${formattedResults.length} results shown).`;

            const response = {
                success: true,
                totalCount: results.totalCount,
                resultsReturned: formattedResults.length,
                query: enhancedQuery,
                repositories: repositoryNames,
                pagination: {
                    page: results.pagination.page,
                    perPage: results.pagination.perPage,
                    hasMore: results.pagination.hasMore,
                },
                results: formattedResults,
                message: results.totalCount === 0 
                    ? `No results found for "${query}". Try broadening your search or using different terms.`
                    : `Found ${results.totalCount} results for "${query}".${paginationInfo}`,
                tip: formattedResults.length > 0 
                    ? 'Use readGitHubFile to read the full contents of any file that looks relevant.'
                    : 'Try searching for different terms, or use listGitHubDirectory to explore the repository structure.',
            };

            logger.info('[GitHub KB] searchGitHubCode - Response', {
                success: true,
                totalCount: results.totalCount,
                resultsReturned: formattedResults.length,
            });
            logger.debug('[GitHub KB] searchGitHubCode - Full response', { response });

            // Build URL with repository filter
            const repoFilter = repositoryNames.map(repo => `repo:${repo}`).join(' ');
            const urlQuery = `${enhancedQuery} ${repoFilter}`;
            const searchUrl = `https://github.com/search?q=${encodeURIComponent(urlQuery)}&type=code`;

            // Track the action
            runContext.context.trackAction({
                action: 'Searched GitHub code',
                integration: IntegrationType.GITHUB,
                target: repositoryNames.join(', '),
                details: `Semantic search for "${query}": Found ${results.totalCount} result(s)${results.pagination.hasMore ? ` (showing page ${results.pagination.page})` : ''}`,
                url: searchUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

            return response;
        } catch (error: any) {
            logger.error('[GitHub KB] searchGitHubCode - Failed', { 
                query: enhancedQuery, 
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                error: error.message,
                query: enhancedQuery,
                tip: 'If the search query is too complex, try simplifying it. Use specific function names or class names.',
            };
        }
    },
});
