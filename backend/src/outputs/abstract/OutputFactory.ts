import { OutputConfigType } from "@prisma/client"

import {
    AttioOutputConfig,
    ConfigInstance,
    ConfluenceConfig,
    DatadogConfig,
    GitHubConfig,
    GmailDraftOutputConfig,
    GmailOutputConfig,
    JiraConfig,
    LaunchDarklyConfig,
    LinearOutputConfig,
    NotionConfig,
    PosthogConfig,
    SlackOutputConfig,
    TerseConfig,
    WorkOSOutputConfig
} from "../../shared/Configs"
import { AgentOutputWithConfigs, AgentWithRelations } from "../../types/prisma"
import { convertPrismaOutputConfigToConfigInstance } from "../../utility/typeConverters"
import { ConfluenceOutput } from "../ConfluenceOutput"
import { AttioOutput } from "../attio/AttioOutput"
import { DatadogSkillOutput } from "../datadog/DatadogSkillOutput"
import { GithubSkillOutput } from "../github/GithubSkillOutput"
import { GmailDraftOutput } from "../gmail/GmailDraftOutput"
import { GmailOutput } from "../gmail/GmailOutput"
import { JiraTicketOutput } from "../jira/JiraTicketOutput"
import { LaunchDarklySkillOutput } from "../launchdarkly/LaunchDarklySkillOutput"
import { LinearTicketOutput } from "../linear/LinearTicketOutput"
import { NotionOutput } from "../notion/NotionOutput"
import { PosthogSkillOutput } from "../posthog/PosthogSkillOutput"
import { SlackOutput } from "../slack/SlackOutput"
import { TerseSkillsOutput } from "../terse/TerseSkillsOutput"
import { WorkOSOutput } from "../workos/WorkOSOutput"

import { Output } from "./Output"

/**
 * Factory for creating Output instances based on IntegrationType.
 * Uses a registry pattern to map integration types to their corresponding Output implementations.
 * No switch statements - each output type is registered independently.
 */
export class OutputFactory {
    public static readonly OUTPUT_REGISTRY: Map<OutputConfigType, () => Output<ConfigInstance>> = new Map<OutputConfigType, () => Output<ConfigInstance>>([
        [OutputConfigType.NOTION, () => new NotionOutput()],
        [OutputConfigType.CONFLUENCE, () => new ConfluenceOutput()],
        [OutputConfigType.LINEAR_TICKET, () => new LinearTicketOutput()],
        [OutputConfigType.JIRA_TICKET, () => new JiraTicketOutput()],
        [OutputConfigType.SLACK_CHANNEL, () => new SlackOutput()],
        [OutputConfigType.GMAIL, () => new GmailOutput()],
        [OutputConfigType.GMAIL_DRAFT, () => new GmailDraftOutput()],
        [OutputConfigType.TERSE, () => new TerseSkillsOutput()],
        [OutputConfigType.ATTIO, () => new AttioOutput()],
        [OutputConfigType.GITHUB, () => new GithubSkillOutput()],
        [OutputConfigType.POSTHOG, () => new PosthogSkillOutput()],
        [OutputConfigType.DATADOG, () => new DatadogSkillOutput()],
        [OutputConfigType.LAUNCHDARKLY, () => new LaunchDarklySkillOutput()],
        [OutputConfigType.WORKOS, () => new WorkOSOutput()]
        // Where is workOS?
    ])

    static createOutput(integrationType: OutputConfigType): Output<ConfigInstance> | null {
        const factory = this.OUTPUT_REGISTRY.get(integrationType)
        if (!factory) {
            return null
        }
        return factory()
    }

    static createOutputWithConfigs(configType: OutputConfigType, configs: ConfigInstance[]): Output<ConfigInstance> | null {
        const output = this.createOutput(configType)
        if (!output) {
            return null
        }
        switch (configType) {
            case OutputConfigType.NOTION:
                ;(output as Output<NotionConfig>).configs = configs as NotionConfig[]
                break
            case OutputConfigType.CONFLUENCE:
                ;(output as Output<ConfluenceConfig>).configs = configs as ConfluenceConfig[]
                break
            case OutputConfigType.LINEAR_TICKET:
                ;(output as Output<LinearOutputConfig>).configs = configs as LinearOutputConfig[]
                break
            case OutputConfigType.JIRA_TICKET:
                ;(output as Output<JiraConfig>).configs = configs as JiraConfig[]
                break
            case OutputConfigType.SLACK_CHANNEL:
                ;(output as Output<SlackOutputConfig>).configs = configs as SlackOutputConfig[]
                break
            case OutputConfigType.GMAIL:
                ;(output as Output<GmailOutputConfig>).configs = configs as GmailOutputConfig[]
                break
            case OutputConfigType.GMAIL_DRAFT:
                ;(output as Output<GmailDraftOutputConfig>).configs = configs as GmailDraftOutputConfig[]
                break
            case OutputConfigType.ATTIO:
                ;(output as Output<AttioOutputConfig>).configs = configs as AttioOutputConfig[]
                break
            case OutputConfigType.GITHUB:
                ;(output as Output<GitHubConfig>).configs = configs as GitHubConfig[]
                break
            case OutputConfigType.POSTHOG:
                ;(output as Output<PosthogConfig>).configs = configs as PosthogConfig[]
                break
            case OutputConfigType.DATADOG:
                ;(output as Output<DatadogConfig>).configs = configs as DatadogConfig[]
                break
            case OutputConfigType.LAUNCHDARKLY:
                ;(output as Output<LaunchDarklyConfig>).configs = configs as LaunchDarklyConfig[]
                break
            case OutputConfigType.WORKOS:
                ;(output as Output<WorkOSOutputConfig>).configs = configs as WorkOSOutputConfig[]
                break
            case OutputConfigType.TERSE:
                ;(output as Output<TerseConfig>).configs = configs as TerseConfig[]
                break
            default:
                throw configType satisfies never
        }
        return output
    }

    static createOutputsFromAgent(agent: AgentWithRelations): Output<ConfigInstance>[] {
        if (!agent.outputs || agent.outputs.length === 0) {
            throw new Error(`No output integrations found for agent: ${agent.id}`)
        }

        // Group configs by type
        const configsByType = new Map<OutputConfigType, ConfigInstance[]>()
        for (const outputIntegration of agent.outputs) {
            const configType = outputIntegration.config_type as OutputConfigType
            // Skip TERSE - it's always included automatically
            if (configType === OutputConfigType.TERSE) {
                continue
            }
            if (!configsByType.has(configType)) {
                configsByType.set(configType, [])
            }
            configsByType.get(configType)!.push(convertPrismaOutputConfigToConfigInstance(outputIntegration as AgentOutputWithConfigs))
        }

        // Create one output instance per type with all configs of that type
        const outputs: Output<ConfigInstance>[] = []
        for (const [configType, configs] of configsByType.entries()) {
            const output = this.createOutputWithConfigs(configType, configs)
            if (!output) {
                throw new Error(`Output type ${configType} is not supported`)
            }
            outputs.push(output)
        }

        // Always include TerseSkillsOutput (no config needed)
        const terseSkills = this.createOutput(OutputConfigType.TERSE)
        if (terseSkills) {
            outputs.push(terseSkills)
        }

        return outputs
    }
}
