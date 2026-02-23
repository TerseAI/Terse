import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata, getContextLabel } from "../../capabilityHelpers"
import { validateGithubRepositoryIds } from "../../integrations/GithubIntegration"
import { ConfigType, GitHubConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { GitHubConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { Output, ToolboxEntry } from "../abstract/Output"

import { grepGitHubCodeTool } from "./tools/grepCode"
import { listGitHubCommitsTool } from "./tools/listCommits"
import { listGitHubDirectoryTool } from "./tools/listDirectory"
import { listGitHubPullRequestsTool } from "./tools/listPullRequests"
import { readGitHubFileTool } from "./tools/readFile"
import { searchGitHubCodeTool } from "./tools/searchCode"
import { summarizeGitHubPullRequestDiffTool } from "./tools/summarizePullRequestDiff"

/**
 * GitHub skill output. This is backed by automation_outputs rows and reuses
 * the same read-only toolbox that used to live in GitHub knowledge bases.
 */
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

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        const base = buildDummyOutputConfig("example", { config_type: OutputConfigType.GITHUB, github_config: { repository_ids: [0] } })

        return {
            ...base,
            github_config: {
                id: "example",
                automation_input_id: null,
                automation_output_id: base.id,
                repository_ids: [0],
                created_at: new Date(0),
                updated_at: new Date(0)
            }
        }
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No GitHub skill configs provided")
        }

        const lines: string[] = []
        lines.push("=== GITHUB SKILL (READ-ONLY) ===")
        lines.push("Available configurations:")
        for (const config of configs) {
            const repoIds = config.github_config?.repository_ids ?? []
            lines.push(`  • Integration ID: ${config.integration_id} - Repository IDs: ${repoIds.length > 0 ? repoIds.join(", ") : "N/A"}`)
        }
        lines.push("\nGitHub tools are read-only in this skill and automatically use the connected user's GitHub token.")
        lines.push("Use repository IDs from the configured entries when calling GitHub tools.")
        return lines.join("\n")
    }
}
