import { OutputConfigType } from "@prisma/client"
import { GitHubConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { validateGithubRepositoryIds } from "../../integrations/GithubIntegration"
import logger from "../../logger"
import { PrismaTransaction } from "../../types/prisma"
import { Output, RuntimeSystemInstructionsContext, defineToolEntry } from "../abstract/Output"

import { createGitHubClient, getGitHubAccessToken, getRepositoryNamesByIds } from "./githubApiClient"
import { grepGitHubCodeTool, validateGrepGitHubCode } from "./tools/grepCode"
import { listGitHubCommitsTool, validateListGitHubCommits } from "./tools/listCommits"
import { listGitHubDirectoryTool, validateListGitHubDirectory } from "./tools/listDirectory"
import { listGitHubPullRequestsTool, validateListGitHubPullRequests } from "./tools/listPullRequests"
import { readGitHubFileTool, validateReadGitHubFile } from "./tools/readFile"
import { searchGitHubCodeTool, validateSearchGitHubCode } from "./tools/searchCode"
import { summarizeGitHubPullRequestDiffTool, validateSummarizeGitHubPullRequestDiff } from "./tools/summarizePullRequestDiff"

export class GithubSkillOutput extends Output<GitHubConfig> {
    constructor() {
        const t = defineToolEntry<GitHubConfig>()
        const toolbox = [
            t({ tool: searchGitHubCodeTool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Search code", validateACL: validateSearchGitHubCode }),
            t({ tool: grepGitHubCodeTool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Grep code", validateACL: validateGrepGitHubCode }),
            t({ tool: readGitHubFileTool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Read file", validateACL: validateReadGitHubFile }),
            t({ tool: listGitHubDirectoryTool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "List directory", validateACL: validateListGitHubDirectory }),
            t({ tool: listGitHubPullRequestsTool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "List pull requests", validateACL: validateListGitHubPullRequests }),
            t({ tool: listGitHubCommitsTool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "List commits", validateACL: validateListGitHubCommits }),
            t({
                tool: summarizeGitHubPullRequestDiffTool,
                isReadOnly: true,
                integration: IntegrationType.GITHUB,
                displayName: "Summarize PR diff",
                validateACL: validateSummarizeGitHubPullRequestDiff
            })
        ]

        super(OutputConfigType.GITHUB, toolbox)
    }

    async validateConfig(output: GitHubConfig, userId: string): Promise<void> {
        await validateGithubRepositoryIds({
            userId,
            integrationId: output.integrationId,
            repositoryIds: output.repositoryIds,
            configTypeLabel: "github",
            contextLabel: "output"
        })
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: GitHubConfig): Promise<void> {
        await tx.automation_github_configs.create({
            data: {
                automation_output_id: agentOutputId,
                repository_ids: output.repositoryIds
            }
        })
    }

    protected getDummyConfigForCapability(): GitHubConfig {
        return new GitHubConfig("example", [0])
    }

    async getRuntimeSystemInstructions(context: RuntimeSystemInstructionsContext): Promise<string> {
        const accessToken = await getGitHubAccessToken(context.userId)
        if (!accessToken) {
            logger.warn("Skipping GitHub repo-name hydration because no token was found", { userId: context.userId })
            return this.getSystemInstructions()
        }

        const allRepositoryIds = this.configs.flatMap(config => config.repositoryIds ?? [])
        if (!allRepositoryIds.length) {
            return this.getSystemInstructions()
        }

        const client = createGitHubClient(accessToken)
        const repositoryNamesById = await getRepositoryNamesByIds(client, allRepositoryIds)
        return this.buildSystemInstructionsForConfigs(this.configs, repositoryNamesById)
    }

    protected getSystemInstructionsForConfigs(configs: GitHubConfig[]): string {
        return this.buildSystemInstructionsForConfigs(configs, new Map())
    }

    private buildSystemInstructionsForConfigs(configs: GitHubConfig[], repositoryNamesById: Map<number, string>): string {
        if (configs.length === 0) {
            throw new Error("No GitHub skill configs provided")
        }

        const lines: string[] = []
        lines.push("=== GITHUB SKILL (READ-ONLY) ===")
        lines.push("Available configurations:")
        for (const config of configs) {
            const repoIds = config.repositoryIds ?? []
            const repoDetails = repoIds
                .map(repoId => {
                    const name = repositoryNamesById.get(repoId)
                    return name ? `${name} (ID: ${repoId})` : `ID: ${repoId}`
                })
                .join(", ")
            lines.push(`  • Integration ID: ${config.integrationId} - Repositories: ${repoDetails || "N/A"}`)
        }
        lines.push("\nGitHub tools are read-only in this skill and automatically use the connected user's GitHub token.")
        lines.push('When a tool asks for repository, use the configured entries above (prefer "owner/repo" when available, otherwise use repository IDs).')
        return lines.join("\n")
    }
}

