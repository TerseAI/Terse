import { OutputConfigType } from "@prisma/client";
import { Output } from "./Output";
import { NotionDatabaseOutput } from "../notion/NotionDatabaseOutput";
import { NotionPageOutput } from "../notion/NotionPageOutput";
import { ConfluenceOutput } from "../ConfluenceOutput";
import { ConfigInstance } from "../../shared/Configs";
import { LinearTicketOutput } from "../linear/LinearTicketOutput";
import { JiraTicketOutput } from "../jira/JiraTicketOutput";
import { SlackOutput } from "../slack/SlackOutput";
import { AgentOutputWithConfigs, AgentWithRelations } from "../../types/prisma";
import { GmailOutput } from "../gmail/GmailOutput";
import { TerseSkillsOutput } from "../terse/TerseSkillsOutput";

/**
 * Factory for creating Output instances based on IntegrationType.
 * Uses a registry pattern to map integration types to their corresponding Output implementations.
 * No switch statements - each output type is registered independently.
 */
export class OutputFactory {
    public static readonly OUTPUT_REGISTRY: Map<OutputConfigType, () => Output<ConfigInstance>> = new Map<OutputConfigType, () => Output<ConfigInstance>>([
        [OutputConfigType.NOTION_DATABASE, () => new NotionDatabaseOutput()],
        [OutputConfigType.NOTION_PAGE, () => new NotionPageOutput()],
        [OutputConfigType.CONFLUENCE, () => new ConfluenceOutput()],
        [OutputConfigType.LINEAR_TICKET, () => new LinearTicketOutput()],
        [OutputConfigType.JIRA_TICKET, () => new JiraTicketOutput()],
        [OutputConfigType.SLACK_CHANNEL, () => new SlackOutput()],
        [OutputConfigType.GMAIL, () => new GmailOutput()],
        [OutputConfigType.TERSE, () => new TerseSkillsOutput()]
    ]);

    static createOutput(integrationType: OutputConfigType): Output<ConfigInstance> | null {
        const factory = this.OUTPUT_REGISTRY.get(integrationType);
        if (!factory) {
            return null;
        }
        return factory();
    }

    static createOutputWithConfigs(configType: OutputConfigType, configs: AgentOutputWithConfigs[]): Output<ConfigInstance> | null {
        const output = this.createOutput(configType);
        if (!output) {
            return null;
        }
        output.configs = configs;
        return output;
    }

    static createOutputsFromAgent(agent: AgentWithRelations): Output<ConfigInstance>[] {
        if (!agent.outputs || agent.outputs.length === 0) {
            throw new Error(`No output integrations found for agent: ${agent.id}`);
        }

        // Group configs by type
        const configsByType = new Map<OutputConfigType, AgentOutputWithConfigs[]>();
        for (const outputIntegration of agent.outputs) {
            const configType = outputIntegration.config_type as OutputConfigType;
            // Skip TERSE - it's always included automatically
            if (configType === OutputConfigType.TERSE) {
                continue;
            }
            if (!configsByType.has(configType)) {
                configsByType.set(configType, []);
            }
            configsByType.get(configType)!.push(outputIntegration as AgentOutputWithConfigs);
        }

        // Create one output instance per type with all configs of that type
        const outputs: Output<ConfigInstance>[] = [];
        for (const [configType, configs] of configsByType.entries()) {
            const output = this.createOutputWithConfigs(configType, configs);
            if (!output) {
                throw new Error(`Output type ${configType} is not supported`);
            }
            outputs.push(output);
        }

        // Always include TerseSkillsOutput (no config needed)
        const terseSkills = this.createOutput(OutputConfigType.TERSE);
        if (terseSkills) {
            outputs.push(terseSkills);
        }

        return outputs;
    }
}