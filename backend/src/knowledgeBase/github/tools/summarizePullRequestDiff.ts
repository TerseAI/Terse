import { RunContext, tool } from "@openai/agents";
import { Agent, AgentInputItem, run, user, AgentOutputType } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { createGitHubClient, getPullRequestDiff, parseRepoFullName, getGitHubAccessToken } from "../githubApiClient";
import { Session } from "../../../server";
import { runnerFactory } from "../../../agent/runner";
import { settings } from "../../../config/settings";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";

/**
 * Tool for summarizing pull request diffs using a compact sub-agent.
 * Instead of returning the full diff to the main context window, this tool
 * launches a sub-agent with a compact model (gpt-4o-mini) that reads the diff
 * and provides a concise summary.
 */
export const summarizeGitHubPullRequestDiffTool = tool({
    name: 'summarizeGitHubPullRequestDiff',
    description: `Summarize the diff of a pull request from a GitHub repository using an intelligent sub-agent. Use this to:
- Understand what changes were made in a specific PR without loading the full diff into context
- Get a concise summary of code changes before merging
- Analyze the impact of a PR on the codebase efficiently
- See file-by-file changes with key insights

The tool launches a sub-agent that:
- Reads the full PR diff from GitHub
- Analyzes the changes using a compact model
- Provides a structured summary including:
  - Overview of changes
  - Key files modified
  - Notable additions/removals
  - Impact assessment

You can optionally provide high-level context about what you're looking for in the PR, which will help the sub-agent focus its analysis.`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the GitHub knowledge base to use. Required when multiple GitHub knowledge bases are configured.'),
        repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        pullNumber: z.number().describe('The pull request number (e.g., 123 for PR #123)'),
        page: z.union([z.number().int().min(1), z.null()]).describe('Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1.'),
        context: z.union([z.string(), z.null()]).describe('Optional high-level context about what you\'re looking for in this PR. This helps the sub-agent focus its analysis. For example: "I need to understand the authentication changes" or "Focus on database migration changes". Use null if no specific context.'),
    }),
    execute: async ({ integrationId, repository, pullNumber, page, context }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        const pageNumber = Math.max(1, page ?? 1);
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
            tool: 'summarizeGitHubPullRequestDiff',
            repository,
            owner,
            repo,
            pullNumber,
            page: pageNumber,
            hasContext: !!context,
        };
        logger.info('[GitHub KB] summarizeGitHubPullRequestDiff - Request', requestParams);

        try {
            // Fetch the PR diff
            logger.info('[GitHub KB] summarizeGitHubPullRequestDiff - Fetching PR diff', {
                repository,
                pullNumber,
                page: pageNumber,
            });

            const prDiff = await getPullRequestDiff(client, owner, repo, pullNumber, { page: pageNumber });

            logger.debug('[GitHub KB] summarizeGitHubPullRequestDiff - Raw API response', {
                number: prDiff.number,
                title: prDiff.title,
                state: prDiff.state,
                merged: prDiff.merged,
                filesChanged: prDiff.filesChanged.length,
                additions: prDiff.additions,
                deletions: prDiff.deletions,
                diffLength: prDiff.diff.length,
                page: prDiff.pagination.page,
                hasMore: prDiff.pagination.hasMore,
            });

            // Build the system prompt for the sub-agent
            const systemPrompt = buildSummarizerSystemPrompt(context ?? undefined);

            // Build the user prompt with the PR diff
            const userPrompt = buildSummarizerUserPrompt(prDiff, context ?? undefined);

            // Create the sub-agent with compact model
            const summarizerAgent = new Agent<Session, AgentOutputType>({
                name: 'PR Diff Summarizer',
                instructions: systemPrompt,
                model: 'gpt-4o-mini',
                modelSettings: {
                    temperature: 0.3,
                    maxTokens: 2000, // Allow enough tokens for a comprehensive summary
                },
                tools: [], // No tools needed - just summarize
            });

            // Prepare the history for the sub-agent
            const history: AgentInputItem[] = [
                user(userPrompt)
            ];

            // Get run context for the sub-agent
            // Extract available context from the tool context (which is the merged session)
            const toolContext = runContext?.context as any;
            const userId = toolContext?.user?.id || toolContext?.userId || '';
            const channelId = toolContext?.channel?.id || toolContext?.channelId || '';
            // Generate a unique runId for the sub-agent
            const subAgentRunId = `pr-summary-${Date.now()}-${pullNumber}`;

            // Create runner for the sub-agent
            const runner = runnerFactory({
                channelId: channelId,
                runId: subAgentRunId,
                userId: userId,
                env: settings.nodeEnv,
            });

            // Run the sub-agent
            logger.info('[GitHub KB] summarizeGitHubPullRequestDiff - Launching sub-agent', {
                repository,
                pullNumber,
                model: 'gpt-4o-mini',
            });

            const result = await runner.run(summarizerAgent, history, {
                stream: false, // We don't need streaming for the sub-agent
                context: runContext?.context as any,
            });

            // Extract the summary from the result
            let summary: string;
            if (result.finalOutput) {
                summary = typeof result.finalOutput === 'string' 
                    ? result.finalOutput 
                    : JSON.stringify(result.finalOutput);
            } else {
                // Fallback: extract from text messages if finalOutput is not available
                const textMessages = result.history
                    .filter((item: any) => item.role === 'assistant' && item.content)
                    .map((item: any) => {
                        if (typeof item.content === 'string') {
                            return item.content;
                        }
                        if (Array.isArray(item.content)) {
                            return item.content
                                .filter((part: any) => part.type === 'text' && part.text)
                                .map((part: any) => part.text)
                                .join('\n');
                        }
                        return '';
                    })
                    .join('\n');
                
                summary = textMessages || 'Unable to generate summary.';
            }

            // Check if this is a paginated view (either on page > 1, or there are more pages available)
            const isPaginated = prDiff.pagination.page > 1 || prDiff.pagination.hasMore;
            
            // Calculate page-level stats from files on current page
            const pageAdditions = prDiff.filesChanged.reduce((sum: number, file: any) => sum + (file.additions || 0), 0);
            const pageDeletions = prDiff.filesChanged.reduce((sum: number, file: any) => sum + (file.deletions || 0), 0);
            const pageTotalChanges = pageAdditions + pageDeletions;
            
            // Build pagination info only when actually paginated
            const paginationInfo = isPaginated
                ? (prDiff.pagination.hasMore
                    ? ` Page ${prDiff.pagination.page} of files (${prDiff.filesChanged.length} files shown). More files available - use page ${prDiff.pagination.page + 1} to see more.`
                    : ` Page ${prDiff.pagination.page} of files (${prDiff.filesChanged.length} files shown).`)
                : '';

            // Build summary object with clear distinction between page-level and PR-wide stats
            const summaryObject: any = {
                filesChanged: prDiff.filesChanged.length,
            };
            
            if (isPaginated) {
                // When paginated, include both page-level and PR-wide stats
                summaryObject.page = {
                    filesChanged: prDiff.filesChanged.length,
                    additions: pageAdditions,
                    deletions: pageDeletions,
                    totalChanges: pageTotalChanges,
                };
                summaryObject.prWide = {
                    additions: prDiff.additions,
                    deletions: prDiff.deletions,
                    totalChanges: prDiff.totalChanges,
                };
            } else {
                // When not paginated, use PR-wide stats (which are the same as page-level)
                summaryObject.additions = prDiff.additions;
                summaryObject.deletions = prDiff.deletions;
                summaryObject.totalChanges = prDiff.totalChanges;
            }

            // Build message with clear distinction between page-level and PR-wide stats
            let message: string;
            if (isPaginated) {
                message = `Summarized PR #${prDiff.number}: "${prDiff.title}".${paginationInfo} This page: ${pageAdditions} additions, ${pageDeletions} deletions. PR-wide totals: ${prDiff.additions} additions, ${prDiff.deletions} deletions.`;
            } else {
                message = `Summarized PR #${prDiff.number}: "${prDiff.title}". ${prDiff.additions} additions, ${prDiff.deletions} deletions.`;
            }

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
                summary: summaryObject,
                pagination: {
                    page: prDiff.pagination.page,
                    perPage: prDiff.pagination.perPage,
                    hasMore: prDiff.pagination.hasMore,
                },
                analysis: summary, // The summarized analysis from the sub-agent
                message,
            };

            logger.info('[GitHub KB] summarizeGitHubPullRequestDiff - Response', {
                success: true,
                pullNumber: prDiff.number,
                filesChanged: prDiff.filesChanged.length,
                additions: prDiff.additions,
                deletions: prDiff.deletions,
                page: prDiff.pagination.page,
                hasMore: prDiff.pagination.hasMore,
                summaryLength: summary.length,
            });

            // Return action as part of the result
            const fileCount = prDiff.filesChanged.length;
            const additions = isPaginated ? pageAdditions : prDiff.additions;
            const deletions = isPaginated ? pageDeletions : prDiff.deletions;
            const action = {
                action: 'Summarized GitHub PR diff',
                integration: IntegrationType.GITHUB,
                target: `${owner}/${repo}`,
                details: `Summarized PR #${prDiff.number}: ${fileCount} file(s) changed, ${additions}+/${deletions}- lines`,
                url: prDiff.htmlUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            };

            return {
                ...response,
                actions: [action],
            };
        } catch (error: any) {
            logger.error('[GitHub KB] summarizeGitHubPullRequestDiff - Failed', { 
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

function buildSummarizerSystemPrompt(context?: string): string {
    return `You are a code review assistant specialized in analyzing and summarizing pull request diffs.

Your task is to read a GitHub pull request diff and provide a clear, structured summary that helps developers understand:
1. What changed (high-level overview)
2. Which files were modified and why
3. Key additions and removals
4. Potential impact on the codebase
5. Notable patterns or concerns

${context ? `\nCONTEXT FROM PARENT AGENT:\nThe parent agent is specifically interested in: ${context}\nFocus your analysis on this aspect while still providing a comprehensive overview.\n` : ''}

Provide your summary in a clear, structured format that includes:
- A brief overview (2-3 sentences)
- Key files and their changes
- Notable patterns or significant changes
- Any potential concerns or areas that might need attention

Be concise but thorough. Focus on understanding the "why" behind changes, not just listing what changed.`;
}

function buildSummarizerUserPrompt(prDiff: any, context?: string): string {
    const filesList = prDiff.filesChanged
        .map((file: any) => `  - ${file.filename} (${file.status}): +${file.additions}/-${file.deletions} lines`)
        .join('\n');

    // Check if this is a paginated view (page > 1 or hasMore indicates pagination is being used)
    const isPaginated = prDiff.pagination && (prDiff.pagination.page > 1 || prDiff.pagination.hasMore);
    
    // If paginated, build a diff from the file patches in the current page and calculate per-page stats
    let diffToUse: string;
    let additionsToUse: number;
    let deletionsToUse: number;
    let paginationNote = '';

    if (isPaginated) {
        // Build diff from file patches in the current page
        const patches = prDiff.filesChanged
            .map((file: any) => file.patch)
            .filter((patch: string | undefined) => patch !== undefined && patch !== null)
            .join('\n');
        
        diffToUse = patches || '(Diff content not available for this page)';
        
        // Calculate per-page additions/deletions from files in current page
        additionsToUse = prDiff.filesChanged.reduce((sum: number, file: any) => sum + file.additions, 0);
        deletionsToUse = prDiff.filesChanged.reduce((sum: number, file: any) => sum + file.deletions, 0);
        
        paginationNote = `\n\nNOTE: This is a paginated view showing page ${prDiff.pagination.page} (${prDiff.filesChanged.length} files).${prDiff.pagination.hasMore ? ` More files are available on subsequent pages.` : ''}`;
    } else {
        // Not paginated, use the full diff and PR-wide totals
        diffToUse = prDiff.diff;
        additionsToUse = prDiff.additions;
        deletionsToUse = prDiff.deletions;
    }

    return `Please analyze and summarize the following pull request diff:

PULL REQUEST INFORMATION:
- Number: #${prDiff.number}
- Title: ${prDiff.title}
- State: ${prDiff.state}${prDiff.merged ? ' (merged)' : ''}
- Base branch: ${prDiff.baseBranch}
- Head branch: ${prDiff.headBranch}
- Files changed: ${prDiff.filesChanged.length}${isPaginated ? ` (page ${prDiff.pagination.page} of files)` : ''}
- Total changes: +${additionsToUse} additions, -${deletionsToUse} deletions${isPaginated ? ` (for this page only)` : ''}

FILES CHANGED:
${filesList}
${paginationNote}

${context ? `\nFOCUS AREA:\nThe parent agent is particularly interested in: ${context}\nPlease emphasize this in your analysis.\n` : ''}

${isPaginated ? 'DIFF (FOR THIS PAGE OF FILES):' : 'FULL DIFF:'}
\`\`\`diff
${diffToUse}
\`\`\`

Please provide a comprehensive but concise summary of this pull request, focusing on understanding the purpose and impact of the changes.`;
}
