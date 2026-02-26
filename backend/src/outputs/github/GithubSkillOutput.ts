import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata, getContextLabel } from "../../capabilityHelpers"
import { validateGithubRepositoryIds } from "../../integrations/GithubIntegration"
import logger from "../../logger"
import { ConfigType, GitHubConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { GitHubConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { Output, RuntimeSystemInstructionsContext, ToolboxEntry } from "../abstract/Output"
import { createGitHubClient, getGitHubAccessToken, getRepositoryNamesByIds } from "./githubApiClient"

import { grepGitHubCodeTool } from "./tools/grepCode"
import { listGitHubCommitsTool } from "./tools/listCommits"
import { listGitHubDirectoryTool } from "./tools/listDirectory"
import { listGitHubPullRequestsTool } from "./tools/listPullRequests"
import { readGitHubFileTool } from "./tools/readFile"
import { searchGitHubCodeTool } from "./tools/searchCode"
import { summarizeGitHubPullRequestDiffTool } from "./tools/summarizePullRequestDiff"

export class GithubSkillOutput extends Output<GitHubConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: searchGitHubCodeTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Search code" },
            { tool: grepGitHubCodeTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Grep code" },
            { tool: readGitHubFileTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Read file" },
            { tool: listGitHubDirectoryTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "List directory" },
            { tool: listGitHubPullRequestsTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "List pull requests" },
            { tool: listGitHubCommitsTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "List commits" },
            { tool: summarizeGitHubPullRequestDiffTool as Tool, isReadOnly: true, integration: IntegrationType.GITHUB, displayName: "Summarize PR diff" }
        ]

        super(OutputConfigType.GITHUB, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.GITHUB)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.GITHUB,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "GitHub integration connection",
                repositoryIds: "Array of GitHub repository IDs to include"
            },
            systemInstructions
        }
    }

    async validateConfig(output: GitHubConfig, userId: string): Promise<void> {
        GitHubConfigSchema.parse(stripConfigForValidation(output))
        await validateGithubRepositoryIds({
            userId,
            integrationId: output.integrationId,
            repositoryIds: output.repositoryIds,
            configTypeLabel: "github",
            contextLabel: getContextLabel(CapabilityRole.OUTPUT)
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
