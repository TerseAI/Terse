import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, searchCode, parseRepoFullName, getFileContents } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";

/**
 * Tool for semantic code search in GitHub repositories.
 * Uses GitHub's Code Search API to find code by meaning, function names, classes, etc.
 */
export const searchGitHubCodeTool = tool({
    name: 'searchGitHubCode',
    description: `Search GitHub repositories for code by semantic meaning. Use this to find:
- Function or class definitions (e.g., "function handleAuth" or "class UserService")
- Code patterns and implementations (e.g., "useEffect cleanup" or "async/await error handling")
- Specific imports or dependencies (e.g., "import from lodash")
- Comments or documentation (e.g., "TODO refactor")

Tips:
- Start with broad searches, then narrow down
- Use specific terms from the domain (function names, class names, variable names)
- Combine multiple terms for more specific results
- Results include code snippets with matched fragments`,
    parameters: z.object({
        query: z.string().describe('The search query. Use natural language or code-specific terms. Examples: "authentication middleware", "class UserRepository", "handleSubmit form validation"'),
        language: z.string().optional().describe('Filter by programming language (e.g., "typescript", "python", "javascript"). Leave empty to search all languages.'),
        filename: z.string().optional().describe('Filter by filename pattern (e.g., "*.test.ts" for test files, "*.config.*" for config files)'),
        path: z.string().optional().describe('Filter by path (e.g., "src/components" to only search in that directory)'),
        perPage: z.number().default(10).describe('Number of results to return (default: 10, max: 100)'),
    }),
    execute: async ({ query, language, filename, path, perPage = 10 }, runContext?: RunContext<any>) => {
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

        logger.info('Searching GitHub code', { 
            query: enhancedQuery, 
            repositories: githubKBConfig.repositoryNames,
            perPage 
        });

        try {
            const results = await searchCode(
                client,
                enhancedQuery,
                githubKBConfig.repositoryNames,
                { perPage: Math.min(perPage, 100) }
            );

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

            return {
                success: true,
                totalCount: results.totalCount,
                resultsReturned: formattedResults.length,
                query: enhancedQuery,
                repositories: githubKBConfig.repositoryNames,
                results: formattedResults,
                message: results.totalCount === 0 
                    ? `No results found for "${query}". Try broadening your search or using different terms.`
                    : `Found ${results.totalCount} results for "${query}". Showing top ${formattedResults.length}.`,
                tip: formattedResults.length > 0 
                    ? 'Use readGitHubFile to read the full contents of any file that looks relevant.'
                    : 'Try searching for different terms, or use listGitHubDirectory to explore the repository structure.',
            };
        } catch (error: any) {
            logger.error('GitHub code search failed', { query: enhancedQuery, error: error.message });
            return {
                success: false,
                error: error.message,
                query: enhancedQuery,
                tip: 'If the search query is too complex, try simplifying it. Use specific function names or class names.',
            };
        }
    },
});
