import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, searchCode } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";

/**
 * Tool for grep-style exact text search in GitHub repositories.
 * Uses GitHub's Code Search API with exact match patterns.
 */
export const grepGitHubCodeTool = tool({
    name: 'grepGitHubCode',
    description: `Search GitHub repositories for exact text matches, similar to grep. Use this when you need to:
- Find exact function calls (e.g., "getUserById(")
- Find specific error messages or strings
- Find imports of specific modules (e.g., "from '@prisma/client'")
- Find TODO/FIXME comments
- Find specific variable names or constants

This is more precise than semantic search - use it when you know exactly what text you're looking for.`,
    parameters: z.object({
        pattern: z.string().describe('The exact text pattern to search for. For function calls, include the opening parenthesis (e.g., "fetchUser("). For strings, include quotes if needed.'),
        fileExtension: z.string().optional().describe('Filter by file extension (e.g., "ts", "js", "py"). Do not include the dot.'),
        path: z.string().optional().describe('Filter by directory path (e.g., "src/services" to only search in that directory)'),
        perPage: z.number().default(20).describe('Number of results to return (default: 20, max: 100)'),
    }),
    execute: async ({ pattern, fileExtension, path, perPage = 20 }, runContext?: RunContext<any>) => {
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

        logger.info('Grepping GitHub code', { 
            pattern,
            query, 
            repositories: githubKBConfig.repositoryNames,
            perPage 
        });

        try {
            const results = await searchCode(
                client,
                query,
                githubKBConfig.repositoryNames,
                { perPage: Math.min(perPage, 100) }
            );

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

            return {
                success: true,
                totalCount: results.totalCount,
                resultsReturned: formattedResults.length,
                pattern,
                query,
                repositories: githubKBConfig.repositoryNames,
                results: formattedResults,
                message: results.totalCount === 0 
                    ? `No exact matches found for "${pattern}". Try a different pattern or use searchGitHubCode for semantic search.`
                    : `Found ${results.totalCount} files containing "${pattern}". Showing top ${formattedResults.length}.`,
                tip: formattedResults.length > 0 
                    ? 'Use readGitHubFile to see the full file contents and surrounding context.'
                    : 'Try a partial match or use searchGitHubCode for broader semantic search.',
            };
        } catch (error: any) {
            logger.error('GitHub grep search failed', { pattern, query, error: error.message });
            return {
                success: false,
                error: error.message,
                pattern,
                tip: 'If searching for special characters, they may need to be escaped. Try simplifying the pattern.',
            };
        }
    },
});
