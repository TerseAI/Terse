import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, searchCode } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { GitHubKnowledgeBaseSession } from "../GitHubKnowledgeBase";

/**
 * Tool for grep-style exact text search in GitHub repositories.
 * Uses GitHub's Code Search API with exact match patterns.
 */
export const grepGitHubCodeTool = tool({
    name: 'grepGitHubCode',
    description: `Search GitHub repositories for EXACT TEXT MATCHES (like grep). Use this when you KNOW the exact string you're looking for.

Use grepGitHubCode for:
- Exact function calls: "getUserById(", "processPayment()"
- Exact imports: "from '@prisma/client'", "import React from"
- Exact strings: "API_KEY", "TODO:", "FIXME:"
- Known identifiers: class names, constants, variable names you know exist

Use searchGitHubCode instead when you DON'T know the exact text (looking for concepts/patterns).

Examples:
- ✅ "getUserById(" (exact function call)
- ✅ "from '@prisma/client'" (exact import statement)
- ✅ "TODO: refactor" (exact comment)
- ✅ "useState" (exact React hook name)
- ❌ "state management" → Use searchGitHubCode for concepts

This is more precise than semantic search - use it when you know exactly what text to find.`,
    parameters: z.object({
        pattern: z.string().describe('The exact text pattern to search for. For function calls, include the opening parenthesis (e.g., "fetchUser("). For strings, include quotes if needed.'),
        fileExtension: z.union([z.string(), z.null()]).describe('Filter by file extension (e.g., "ts", "js", "py"). Do not include the dot. Use null to search all file types.'),
        path: z.union([z.string(), z.null()]).describe('Filter by directory path (e.g., "src/services" to only search in that directory). Use null to search everywhere.'),
        perPage: z.number().describe('Number of results to return (default: 20, max: 100)'),
        page: z.union([z.number().int().min(1), z.null()]).describe('Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.'),
    }),
    execute: async ({ pattern, fileExtension, path, perPage = 20, page }, runContext?: RunContext<SessionWithTracking<GitHubKnowledgeBaseSession>>) => {
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

        if (githubKBConfig.repositoryNames.length === 0) {
            throw new Error("No repositories configured for this knowledge base.");
        }

        const client = createGitHubClient(accessToken);

        // Build query - wrap in quotes for exact match if not already quoted
        let query = pattern;
        if (!pattern.startsWith('"') && !pattern.endsWith('"')) {
            // GitHub code search uses quotes for exact matching
            query = `"${pattern}"`;
        }
        
        if (fileExtension) {
            query += ` extension:${fileExtension}`;
        }
        if (path) {
            query += ` path:${path}`;
        }

        const pageNumber = Math.max(1, page ?? 1);
        const normalizedPerPage = Math.min(perPage || 20, 100);
        const requestParams = {
            tool: 'grepGitHubCode',
            pattern,
            query,
            filters: { fileExtension, path },
            repositories: githubKBConfig.repositoryNames,
            perPage: normalizedPerPage,
            page: pageNumber,
        };
        logger.info('[GitHub KB] grepGitHubCode - Request', requestParams);
        logger.debug('[GitHub KB] grepGitHubCode - Full request params', { requestParams });

        try {
            const results = await searchCode(
                client,
                query,
                githubKBConfig.repositoryNames,
                { perPage: normalizedPerPage, page: pageNumber }
            );

            logger.debug('[GitHub KB] grepGitHubCode - Raw API response', {
                totalCount: results.totalCount,
                itemCount: results.items.length,
                items: results.items.map(item => ({
                    path: item.path,
                    repository: item.repository.fullName,
                    sha: item.sha,
                    textMatchCount: item.textMatches?.length || 0,
                })),
            });

            // Format results with line-focused snippets
            const formattedResults = results.items.map((item, index) => {
                // Extract the matching lines from text matches
                const matchingLines = item.textMatches?.map(match => {
                    // Try to extract the line containing the match
                    const lines = match.fragment.split('\n');
                    const matchingLinesInFragment = lines.filter(line => 
                        line.toLowerCase().includes(pattern.toLowerCase().replace(/"/g, ''))
                    );
                    return matchingLinesInFragment.length > 0 
                        ? matchingLinesInFragment.join('\n') 
                        : match.fragment;
                }).join('\n') || '(match found, no preview)';
                
                return {
                    index: index + 1,
                    repository: item.repository.fullName,
                    file: item.path,
                    url: item.htmlUrl,
                    matches: matchingLines,
                };
            });

            const paginationInfo = results.pagination.hasMore
                ? ` Page ${results.pagination.page} (${formattedResults.length} results shown). More results available - use page ${results.pagination.page + 1} to see more.`
                : ` Page ${results.pagination.page} (${formattedResults.length} results shown).`;

            const response = {
                success: true,
                totalCount: results.totalCount,
                resultsReturned: formattedResults.length,
                pattern,
                query,
                repositories: githubKBConfig.repositoryNames,
                pagination: {
                    page: results.pagination.page,
                    perPage: results.pagination.perPage,
                    hasMore: results.pagination.hasMore,
                },
                results: formattedResults,
                message: results.totalCount === 0 
                    ? `No exact matches found for "${pattern}". Try a different pattern or use searchGitHubCode for semantic search.`
                    : `Found ${results.totalCount} files containing "${pattern}".${paginationInfo}`,
                tip: formattedResults.length > 0 
                    ? 'Use readGitHubFile to see the full file contents and surrounding context.'
                    : 'Try a partial match or use searchGitHubCode for broader semantic search.',
            };

            logger.info('[GitHub KB] grepGitHubCode - Response', {
                success: true,
                totalCount: results.totalCount,
                resultsReturned: formattedResults.length,
            });
            logger.debug('[GitHub KB] grepGitHubCode - Full response', { response });

            // Track the action
            runContext.context.trackAction({
                action: 'Searched GitHub code (exact match)',
                integration: IntegrationType.GITHUB,
                target: githubKBConfig.repositoryNames.join(', '),
                details: `Exact text search for "${pattern}": Found ${results.totalCount} file(s) containing pattern${results.pagination.hasMore ? ` (showing page ${results.pagination.page})` : ''}`,
                url: `https://github.com/search?q=${encodeURIComponent(query)}&type=code`,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

            return response;
        } catch (error: any) {
            logger.error('[GitHub KB] grepGitHubCode - Failed', { 
                pattern, 
                query, 
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                error: error.message,
                pattern,
                tip: 'If searching for special characters, they may need to be escaped. Try simplifying the pattern.',
            };
        }
    },
});
