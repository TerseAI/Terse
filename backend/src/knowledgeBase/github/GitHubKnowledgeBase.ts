import { Session } from "../../server";
import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { GitHubKBConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { searchGitHubCodeTool } from "./tools/searchCode";
import { grepGitHubCodeTool } from "./tools/grepCode";
import { readGitHubFileTool } from "./tools/readFile";
import { listGitHubDirectoryTool } from "./tools/listDirectory";
import { listGitHubPullRequestsTool } from "./tools/listPullRequests";
import { listGitHubCommitsTool } from "./tools/listCommits";
import { getGitHubAccessToken } from "./githubApiClient";
import logger from "../../logger";

/**
 * Session type for GitHub knowledge base.
 * Extends the base Session with GitHub-specific configuration.
 */
export interface GitHubKnowledgeBaseSession extends Session {
    githubKBConfig: GitHubKBConfig;
    githubAccessToken: string;
}

/**
 * GitHub Knowledge Base implementation.
 * Provides tools for searching, reading, and exploring GitHub repositories.
 */
export class GitHubKnowledgeBase extends KnowledgeBase<GitHubKnowledgeBaseSession, GitHubKBConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: searchGitHubCodeTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: grepGitHubCodeTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: readGitHubFileTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: listGitHubDirectoryTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: listGitHubPullRequestsTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: listGitHubCommitsTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            }
        ];

        super(KnowledgeBaseConfigType.GITHUB, toolbox);
    }

    /**
     * Creates a GitHub knowledge base session from the configuration.
     * Loads the GitHub integration and configures the session with credentials.
     */
    async createSessionFromConfig(
        integrationId: string,
        channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs,
        user: User
    ): Promise<GitHubKnowledgeBaseSession> {
        // Load the GitHub KB config from the channel knowledge base
        if (!channelKnowledgeBase.github_kb_config) {
            throw new Error('GitHub KB config not found in channel knowledge base');
        }

        const githubKBConfig = channelKnowledgeBase.github_kb_config;

        // Get the user's GitHub access token
        const accessToken = await getGitHubAccessToken(user.id);
        if (!accessToken) {
            throw new Error('No GitHub access token found for user. Please reconnect your GitHub integration.');
        }

        // Create the GitHubKBConfig instance
        const config = new GitHubKBConfig(
            integrationId,
            githubKBConfig.repository_ids,
            githubKBConfig.repository_names
        );

        // Verify that repositories are configured
        if (!config.isComplete()) {
            logger.warn('GitHub knowledge base configured but no repositories selected', {
                integrationId,
            });
        }

        // Create the session with GitHub config
        const session: GitHubKnowledgeBaseSession = {
            user,
            isUserInitiated: true,
            githubKBConfig: config,
            githubAccessToken: accessToken,
        };

        return session;
    }

    async addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: GitHubKBConfig): Promise<void> {
        if (knowledgeBase.repositoryIds.length === 0) {
            throw new Error('GitHub KB config requires at least one repository');
        }

        await tx.automation_github_kb_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
                repository_ids: knowledgeBase.repositoryIds,
                repository_names: knowledgeBase.repositoryNames,
            }
        });
    }

    /**
     * Returns system instructions for GitHub knowledge base.
     * Provides guidance on how to effectively explore and understand codebases.
     */
    getSystemInstructions(session: GitHubKnowledgeBaseSession): string {
        const { githubKBConfig } = session;
        const sections: string[] = [];

        // Header
        sections.push('=== GITHUB CODEBASE KNOWLEDGE BASE ===');
        sections.push(`Repositories: ${githubKBConfig.repositoryNames.join(', ')}`);

        // Available tools section
        sections.push(`
AVAILABLE TOOLS:
• searchGitHubCode: SEMANTIC search - find code by CONCEPT/MEANING when you DON'T know exact text.
  Use for: "authentication", "error handling", "database queries" (finds related code by meaning)
  Example: "authentication middleware" finds login, auth, verifyToken, etc.
  
• grepGitHubCode: EXACT text search (like grep) - find specific strings when you KNOW exact text.
  Use for: exact function names, imports, constants, known identifiers
  Example: "getUserById(" finds only that exact function call
  
• readGitHubFile: Read full file contents. Use after finding relevant files via search.
  Supports line ranges for large files: startLine/endLine parameters.
  
• listGitHubDirectory: Browse directory structure. Start from root to understand project layout.

• listGitHubPullRequests: List PRs in a time window. Find merged PRs, track development activity.
  Filter by state (open/closed/all), date range (since/until).
  Example: since "2024-01-01" to see PRs from the new year.
  
• listGitHubCommits: List commits in a time window. Track code changes, find commits by author or path.
  Filter by date range, branch, file path, or author.
  Example: path "src/auth" to see commits affecting authentication code.`);

        sections.push(`
CODE EXPLORATION STRATEGY:
Explore code like an experienced engineer would - systematically and thoroughly.

1. UNDERSTAND THE STRUCTURE FIRST:
   - Start with listGitHubDirectory on the root to see project layout
   - Identify key directories: src/, lib/, components/, services/, etc.
   - Look for README, package.json, or config files to understand the stack

2. SEARCH BEFORE READING:
   - Use searchGitHubCode for CONCEPTS you don't know exact text for ("how does auth work", "error handling patterns")
   - Use grepGitHubCode for EXACT strings you know ("loginUser(", "export class Auth", exact imports)
   - Review search snippets before deciding which files to read fully

3. FOLLOW THE TRAIL:
   - When you find relevant code, check its imports and dependencies
   - Look for related files (tests, types, interfaces)
   - Trace function calls to understand data flow

4. READ STRATEGICALLY:
   - Don't read entire files blindly - use search results to target specific sections
   - For large files (500+ lines), use startLine/endLine to read specific sections
   - Read imports at the top to understand dependencies

5. CROSS-REFERENCE:
   - If you find a function definition, grep for its usages
   - If you find an interface, search for its implementations
   - Connect the dots between different parts of the codebase

COMMON PATTERNS TO LOOK FOR:
- Entry points: main.ts, index.ts, app.ts, server.ts
- Configuration: config/, settings.ts, .env files (structure only)
- Core logic: services/, lib/, core/, domain/
- API routes: routes/, api/, controllers/
- Data models: models/, entities/, types/, schemas/
- Tests: __tests__/, *.test.ts, *.spec.ts

REPORTING YOUR FINDINGS:
When explaining code to the user:
- Reference specific files and line numbers
- Include relevant code snippets
- Explain the "why" not just the "what"
- Link related concepts together
- Suggest next areas to explore if relevant`);

        return sections.join('\n');
    }
}
