import { Tool } from "@openai/agents";
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
import { summarizeGitHubPullRequestDiffTool } from "./tools/summarizePullRequestDiff";
import logger from "../../logger";
import { validateGithubRepositoryIds } from "../../integrations/githubValidation";

/**
 * GitHub Knowledge Base implementation.
 * Provides tools for searching, reading, and exploring GitHub repositories.
 */
export class GitHubKnowledgeBase extends KnowledgeBase<GitHubKBConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: searchGitHubCodeTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: grepGitHubCodeTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: readGitHubFileTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: listGitHubDirectoryTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: listGitHubPullRequestsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: listGitHubCommitsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            },
            {
                tool: summarizeGitHubPullRequestDiffTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB
            }
        ];

        super(KnowledgeBaseConfigType.GITHUB, toolbox);
    }


    async validateConfig(knowledgeBase: GitHubKBConfig, userId: string): Promise<void> {
        await validateGithubRepositoryIds({
            userId,
            integrationId: knowledgeBase.integrationId,
            repositoryIds: knowledgeBase.repositoryIds,
            configTypeLabel: 'github_kb',
            contextLabel: 'knowledge base',
        });
    }

    async addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: GitHubKBConfig): Promise<void> {
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
    getSystemInstructions(configs: ChannelKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No GitHub KB configs provided');
        }
        
        const sections: string[] = [];

        // Header
        sections.push('=== GITHUB CODEBASE KNOWLEDGE BASE ===');
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.github_kb_config) {
                throw new Error('GitHub KB config not found');
            }
            const repositoryNames = config.github_kb_config.repository_names || [];
            const repositoryIds = config.github_kb_config.repository_ids || [];
            const repoDetails = repositoryNames.map((name, idx) => {
                const id = repositoryIds[idx] || 'N/A';
                return `${name} (ID: ${id})`;
            }).join(', ');
            configList.push(`  • Integration ID: ${config.integration_id} - Repositories: ${repoDetails || 'N/A'}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling GitHub tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.');

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
  Example: path "src/auth" to see commits affecting authentication code.
  
• summarizeGitHubPullRequestDiff: Summarize the diff of a pull request using an intelligent sub-agent. 
  This tool launches a compact model that reads the full PR diff and provides a structured summary,
  avoiding the need to load large diffs into the main context window. You can optionally provide
  context about what you're looking for to help focus the analysis.
  Use after finding a PR with listGitHubPullRequests to understand what was changed.
  Example: summarizeGitHubPullRequestDiff with pullNumber 123 to get a summary of PR #123.
  Example with context: summarizeGitHubPullRequestDiff with pullNumber 123 and context "authentication changes".`);

        sections.push(`
CODE EXPLORATION STRATEGY:
Explore code like an experienced engineer would - systematically and thoroughly.

⚠️ CRITICAL FIRST STEP - READ DOCUMENTATION BEFORE MAKING CHANGES:
Before making any changes or proposing modifications, you MUST first read key documentation files
to understand the project's purpose, conventions, architecture, and requirements:

1. READ DOCUMENTATION FIRST (MANDATORY):
   - ALWAYS start by reading README.md (or README.txt, README.rst) - this explains the project
   - Check for CONTRIBUTING.md - contains contribution guidelines
   - Look for ARCHITECTURE.md, DESIGN.md, or docs/ folder for architecture documentation
   - Read CHANGELOG.md or HISTORY.md to understand recent changes and patterns
   - Review any setup guides, getting started docs, or onboarding documentation
   - Check package.json, requirements.txt, or similar dependency files for tech stack context
   
   These files give you:
   - Project purpose and goals
   - Coding conventions and style guidelines
   - Architecture decisions and patterns
   - Testing requirements
   - Deployment and environment setup
   - How the codebase is organized

2. UNDERSTAND THE STRUCTURE:
   - Start with listGitHubDirectory on the root to see project layout
   - Identify key directories: src/, lib/, components/, services/, etc.
   - Look for package.json, requirements.txt, or config files to understand the stack
   - Note any documentation folders (docs/, wiki/, documentation/)

3. SEARCH BEFORE READING:
   - Use searchGitHubCode for CONCEPTS you don't know exact text for ("how does auth work", "error handling patterns")
   - Use grepGitHubCode for EXACT strings you know ("loginUser(", "export class Auth", exact imports)
   - Review search snippets before deciding which files to read fully

4. FOLLOW THE TRAIL:
   - When you find relevant code, check its imports and dependencies
   - Look for related files (tests, types, interfaces)
   - Trace function calls to understand data flow

5. READ STRATEGICALLY:
   - Don't read entire files blindly - use search results to target specific sections
   - For large files (500+ lines), use startLine/endLine to read specific sections
   - Read imports at the top to understand dependencies

6. CROSS-REFERENCE:
   - If you find a function definition, grep for its usages
   - If you find an interface, search for its implementations
   - Connect the dots between different parts of the codebase

COMMON PATTERNS TO LOOK FOR:
- Documentation (READ FIRST): README.md, CONTRIBUTING.md, ARCHITECTURE.md, docs/
- Entry points: main.ts, index.ts, app.ts, server.ts
- Configuration: config/, settings.ts, .env files (structure only)
- Core logic: services/, lib/, core/, domain/
- API routes: routes/, api/, controllers/
- Data models: models/, entities/, types/, schemas/
- Tests: __tests__/, *.test.ts, *.spec.ts

WHEN MAKING CHANGES:
Before proposing or implementing any changes:
1. Ensure you've read the relevant documentation (especially README.md and CONTRIBUTING.md)
2. Understand the existing code patterns and conventions
3. Follow the project's established architecture and style
4. Consider how your changes fit with the project's goals and constraints
5. Check if similar changes exist in recent PRs or commits to maintain consistency

REPORTING YOUR FINDINGS:
When explaining code to the user:
- Reference specific files and line numbers
- Include relevant code snippets
- Explain the "why" not just the "what"
- Link related concepts together
- Suggest next areas to explore if relevant`);

        return sections.join('\n');
    }

    formatForAvailableConfigurationsSection(config: { integrationId: string, channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs }): string {
        const { integrationId, channelKnowledgeBase } = config;
        if (!channelKnowledgeBase.github_kb_config) {
            throw new Error('GitHub KB config not found');
        }
        const repositoryNames = channelKnowledgeBase.github_kb_config.repository_names;
        const details = `Repositories: ${repositoryNames.join(', ')}`;
        return `Integration ID: ${integrationId}, Type: ${channelKnowledgeBase.config_type}, ${details}`;
    }
}
