import { OutputConfigType } from "@prisma/client"

import { ConfigInstance } from "../../shared/Configs"
import { AgentOutputWithConfigs, AgentWithRelations } from "../../types/prisma"
import { ConfluenceOutput } from "../ConfluenceOutput"
import { AttioOutput } from "../attio/AttioOutput"
import { GmailOutput } from "../gmail/GmailOutput"
import { JiraTicketOutput } from "../jira/JiraTicketOutput"
import { LinearTicketOutput } from "../linear/LinearTicketOutput"
import { NotionOutput } from "../notion/NotionOutput"
import { SlackOutput } from "../slack/SlackOutput"
import { TerseSkillsOutput } from "../terse/TerseSkillsOutput"

import { Output } from "./Output"

/**
 * Factory for creating Output instances based on IntegrationType.
 * Uses a registry pattern to map integration types to their corresponding Output implementations.
 * No switch statements - each output type is registered independently.
 */
export class OutputFactory {
    public static readonly OUTPUT_REGISTRY: Map<OutputConfigType, (readOnly?: boolean) => Output<ConfigInstance>> = new Map<OutputConfigType, (readOnly?: boolean) => Output<ConfigInstance>>([
        [OutputConfigType.NOTION, (readOnly = false) => new NotionOutput(readOnly)],
        [OutputConfigType.CONFLUENCE, (readOnly = false) => new ConfluenceOutput(readOnly)],
        [OutputConfigType.LINEAR_TICKET, (readOnly = false) => new LinearTicketOutput(readOnly)],
        [OutputConfigType.JIRA_TICKET, (readOnly = false) => new JiraTicketOutput(readOnly)],
        [OutputConfigType.SLACK_CHANNEL, (readOnly = false) => new SlackOutput(readOnly)],
        [OutputConfigType.GMAIL, (readOnly = false) => new GmailOutput(readOnly)],
        [OutputConfigType.TERSE, (readOnly = false) => new TerseSkillsOutput(readOnly)],
        [OutputConfigType.ATTIO, (readOnly = false) => new AttioOutput(readOnly)]
    ])

    static createOutput(integrationType: OutputConfigType, readOnly = false): Output<ConfigInstance> | null {
        const factory = this.OUTPUT_REGISTRY.get(integrationType)
        if (!factory) {
            return null
        }
        return factory(readOnly)
    }

    static createOutputWithConfigs(configType: OutputConfigType, configs: AgentOutputWithConfigs[]): Output<ConfigInstance> | null {
        const readOnly = configs.length > 0 && configs.every(config => config.read_only)
        const output = this.createOutput(configType, readOnly)
        if (!output) {
            return null
        }
        output.configs = configs
        return output
    }

    static createOutputsFromAgent(agent: AgentWithRelations): Output<ConfigInstance>[] {
        if (!agent.outputs || agent.outputs.length === 0) {
            throw new Error(`No output integrations found for agent: ${agent.id}`)
        }

        // Group configs by type
        const configsByType = new Map<OutputConfigType, AgentOutputWithConfigs[]>()
        for (const outputIntegration of agent.outputs) {
            const configType = outputIntegration.config_type as OutputConfigType
            // Skip TERSE - it's always included automatically
            if (configType === OutputConfigType.TERSE) {
                continue
            }
            if (!configsByType.has(configType)) {
                configsByType.set(configType, [])
            }
            configsByType.get(configType)!.push(outputIntegration as AgentOutputWithConfigs)
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
