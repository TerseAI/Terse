import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, listDirectory, parseRepoFullName, getRepositoryInfo, getTree, getBranch } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";

/**
 * Tool for listing directory contents in GitHub repositories.
 * Uses GitHub's Contents API and Git Trees API.
 */
export const listGitHubDirectoryTool = tool({
    name: 'listGitHubDirectory',
    description: `List files and directories in a GitHub repository. Use this to:
- Explore the repository structure
- Find where specific types of files are located
- Understand the project organization
- Navigate to specific directories before reading files

Start with the root directory (empty path) to see the top-level structure, then drill down into interesting directories.`,
    parameters: z.object({
        repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        path: z.string().describe('The directory path to list (e.g., "src/components"). Use empty string "" for root directory.'),
        recursive: z.boolean().describe('If true, list all files recursively (can be large for big repos). Use false for single-level listing.'),
    }),
    execute: async ({ repository, path = '', recursive = false }, runContext?: RunContext<any>) => {
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
            tool: 'listGitHubDirectory',
            repository,
            owner,
            repo,
            path: path || '(root)',
            recursive,
        };
        logger.info('[GitHub KB] listGitHubDirectory - Request', requestParams);
        logger.debug('[GitHub KB] listGitHubDirectory - Full request params', { requestParams });

        try {
            if (recursive) {
                // Use Git Trees API for recursive listing
                const repoInfo = await getRepositoryInfo(client, owner, repo);
                if (!repoInfo) {
                    throw new Error('Failed to get repository info');
                }

                logger.debug('[GitHub KB] listGitHubDirectory - Got repo info', {
                    defaultBranch: repoInfo.defaultBranch,
                    fullName: repoInfo.fullName,
                });

                // Get the tree SHA for the default branch
                const branchInfo = await getBranch(client, owner, repo, repoInfo.defaultBranch);
                const treeSha = branchInfo.treeSha;

                logger.debug('[GitHub KB] listGitHubDirectory - Got branch info', {
                    treeSha,
                    commitSha: branchInfo.commitSha,
                });

                const treeResult = await getTree(client, owner, repo, treeSha, true);

                logger.debug('[GitHub KB] listGitHubDirectory - Got tree', {
                    itemCount: treeResult.tree.length,
                    truncated: treeResult.truncated,
                });

                // Filter to only show items within the specified path
                let items = treeResult.tree;
                if (path) {
                    items = items.filter(item => item.path.startsWith(path + '/') || item.path === path);
                }

                // Format as a tree structure
                const formattedItems = items.map(item => ({
                    path: item.path,
                    type: item.type === 'blob' ? 'file' : 'directory',
                    size: item.size,
                }));

                // Group by directory for easier reading
                const directories = new Set<string>();
                const files: typeof formattedItems = [];
                
                formattedItems.forEach(item => {
                    if (item.type === 'directory') {
                        directories.add(item.path);
                    } else {
                        files.push(item);
                    }
                });

                const response = {
                    success: true,
                    repository,
                    path: path || '(root)',
                    recursive: true,
                    truncated: treeResult.truncated,
                    totalItems: formattedItems.length,
                    directories: Array.from(directories).sort(),
                    files: files.slice(0, 200).map(f => ({
                        path: f.path,
                        size: f.size,
                    })),
                    warning: treeResult.truncated 
                        ? 'Results truncated due to repository size. Use a more specific path.'
                        : files.length > 200 
                            ? `Showing first 200 of ${files.length} files. Use a more specific path to narrow results.`
                            : undefined,
                };

                logger.info('[GitHub KB] listGitHubDirectory - Response (recursive)', {
                    success: true,
                    totalItems: formattedItems.length,
                    dirCount: directories.size,
                    fileCount: files.length,
                    truncated: treeResult.truncated,
                });
                logger.debug('[GitHub KB] listGitHubDirectory - Full response', { response });

                return response;
            } else {
                // Use Contents API for non-recursive listing
                const entries = await listDirectory(client, owner, repo, path);

                logger.debug('[GitHub KB] listGitHubDirectory - Got entries', {
                    entryCount: entries.length,
                    entries: entries.map(e => ({ name: e.name, type: e.type })),
                });

                // Separate directories and files
                const directories = entries.filter(e => e.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
                const files = entries.filter(e => e.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
                const other = entries.filter(e => e.type !== 'dir' && e.type !== 'file');

                // Format output
                const formattedDirs = directories.map(d => ({
                    name: d.name + '/',
                    path: d.path,
                    type: 'directory' as const,
                }));

                const formattedFiles = files.map(f => ({
                    name: f.name,
                    path: f.path,
                    type: 'file' as const,
                    size: f.size,
                }));

                const response = {
                    success: true,
                    repository,
                    path: path || '(root)',
                    recursive: false,
                    totalItems: entries.length,
                    directories: formattedDirs,
                    files: formattedFiles,
                    other: other.length > 0 ? other.map(o => ({ name: o.name, type: o.type })) : undefined,
                    tip: 'Use readGitHubFile to read file contents, or list a subdirectory to explore further.',
                };

                logger.info('[GitHub KB] listGitHubDirectory - Response', {
                    success: true,
                    totalItems: entries.length,
                    dirCount: directories.length,
                    fileCount: files.length,
                });
                logger.debug('[GitHub KB] listGitHubDirectory - Full response', { response });

                return response;
            }
        } catch (error: any) {
            logger.error('[GitHub KB] listGitHubDirectory - Failed', { 
                repository, 
                path: path || '(root)', 
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                error: error.message,
                repository,
                path: path || '(root)',
                tip: error.message.includes('not a directory') 
                    ? 'This path is a file. Use readGitHubFile to read its contents.'
                    : 'Check that the path exists. Use an empty path to list the root directory.',
            };
        }
    },
});
