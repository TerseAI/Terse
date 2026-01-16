import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, getFileContents, parseRepoFullName } from "../githubApiClient";
import { GitHubKBConfig } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { GitHubKnowledgeBaseSession } from "../GitHubKnowledgeBase";

/**
 * Tool for reading file contents from GitHub repositories.
 * Uses GitHub's Contents API to fetch file contents from the default branch.
 */
export const readGitHubFileTool = tool({
    name: 'readGitHubFile',
    description: `Read the full contents of a file from a GitHub repository. Use this after finding relevant files via search to:
- Understand the complete implementation of a function or class
- See imports and dependencies
- Review the full context around a code snippet
- Understand file structure and organization

Note: This reads from the default branch (main/master). Large files may be truncated.`,
    parameters: z.object({
        repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        path: z.string().describe('The file path within the repository (e.g., "src/components/Button.tsx" or "README.md")'),
        startLine: z.union([z.number(), z.null()]).describe('Start reading from this line number (1-indexed). Use with endLine for partial file reads. Use null to start from beginning.'),
        endLine: z.union([z.number(), z.null()]).describe('Stop reading at this line number (1-indexed, inclusive). Use with startLine for partial file reads. Use null to read to end.'),
    }),
    execute: async ({ repository, path, startLine, endLine }, runContext?: RunContext<SessionWithTracking<GitHubKnowledgeBaseSession>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const { githubKBConfig, githubAccessToken } = runContext.context;

        // Validate that the repository is in the configured list
        if (!githubKBConfig.repositoryNames.includes(repository)) {
            return {
                success: false,
                error: `Repository "${repository}" is not configured for this knowledge base.`,
                configuredRepositories: githubKBConfig.repositoryNames,
                tip: 'Use one of the configured repositories listed above.',
            };
        }

        const client = createGitHubClient(githubAccessToken);
        const { owner, repo } = parseRepoFullName(repository);

        const requestParams = {
            tool: 'readGitHubFile',
            repository,
            owner,
            repo,
            path,
            startLine,
            endLine,
        };
        logger.info('[GitHub KB] readGitHubFile - Request', requestParams);
        logger.debug('[GitHub KB] readGitHubFile - Full request params', { requestParams });

        try {
            const fileContent = await getFileContents(client, owner, repo, path);

            logger.debug('[GitHub KB] readGitHubFile - Raw API response', {
                name: fileContent.name,
                path: fileContent.path,
                sha: fileContent.sha,
                size: fileContent.size,
                encoding: fileContent.encoding,
                contentLength: fileContent.content.length,
            });
            
            let content = fileContent.content;
            let totalLines = content.split('\n').length;
            let displayedLines = { start: 1, end: totalLines };

            // Handle line range if specified
            if (startLine !== undefined || endLine !== undefined) {
                const lines = content.split('\n');
                const start = Math.max(1, startLine || 1) - 1; // Convert to 0-indexed
                const end = Math.min(lines.length, endLine || lines.length);
                content = lines.slice(start, end).join('\n');
                displayedLines = { start: start + 1, end };
            }

            // Add line numbers to content for easier reference
            const numberedContent = content.split('\n').map((line, index) => {
                const lineNum = (displayedLines.start + index).toString().padStart(4, ' ');
                return `${lineNum} | ${line}`;
            }).join('\n');

            // Warn if file is very large
            const isLarge = totalLines > 500;
            const isTruncated = content.length > 100000; // ~100KB limit

            let finalContent = numberedContent;
            if (isTruncated) {
                finalContent = numberedContent.substring(0, 100000) + '\n... (file truncated, use startLine/endLine to read specific sections)';
            }

            const response = {
                success: true,
                repository,
                path,
                url: fileContent.htmlUrl,
                totalLines,
                displayedLines: `${displayedLines.start}-${displayedLines.end}`,
                size: fileContent.size,
                content: finalContent,
                warning: isLarge && !startLine 
                    ? `This file has ${totalLines} lines. Consider using startLine/endLine to read specific sections.`
                    : undefined,
            };

            logger.info('[GitHub KB] readGitHubFile - Response', {
                success: true,
                totalLines,
                displayedLines: `${displayedLines.start}-${displayedLines.end}`,
                size: fileContent.size,
                isTruncated,
            });
            logger.debug('[GitHub KB] readGitHubFile - Full response (excluding content)', {
                ...response,
                content: `[${finalContent.length} chars]`,
            });

            // Track the action
            runContext.context.trackAction({
                action: 'Read GitHub file',
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Read file "${path}"${startLine && endLine ? ` (lines ${displayedLines.start}-${displayedLines.end})` : ''} (${totalLines} total lines${isTruncated ? ', truncated' : ''})`,
                url: fileContent.htmlUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

            return response;
        } catch (error: any) {
            logger.error('[GitHub KB] readGitHubFile - Failed', { 
                repository, 
                path, 
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                error: error.message,
                repository,
                path,
                tip: error.message.includes('not a file') 
                    ? 'This path is a directory. Use listGitHubDirectory to see its contents.'
                    : 'Check that the file path is correct. Use searchGitHubCode to find files.',
            };
        }
    },
});
