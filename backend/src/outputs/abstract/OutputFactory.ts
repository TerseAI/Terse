import { OutputConfigType } from "@prisma/client";
import { Output } from "./Output";
import { NotionDatabaseOutput } from "../notion/NotionDatabaseOutput";
import { NotionPageOutput } from "../notion/NotionPageOutput";
import { ConfluenceOutput } from "../ConfluenceOutput";
import { ConfigInstance } from "../../shared/Configs";
import { LinearTicketOutput } from "../linear/LinearTicketOutput";
import { JiraTicketOutput } from "../jira/JiraTicketOutput";
import { SlackOutput } from "../slack/SlackOutput";
import { ChannelOutputWithConfigs, ChannelWithRelations } from "../../types/prisma";
import { GmailOutput } from "../gmail/GmailOutput";

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
        [OutputConfigType.GMAIL, () => new GmailOutput()]
    ]);

    static createOutput(integrationType: OutputConfigType): Output<ConfigInstance> | null {
        const factory = this.OUTPUT_REGISTRY.get(integrationType);
        if (!factory) {
            return null;
        }
        return factory();
    }

    static createOutputWithConfigs(configType: OutputConfigType, configs: ChannelOutputWithConfigs[]): Output<ConfigInstance> | null {
        const output = this.createOutput(configType);
        if (!output) {
            return null;
        }
        output.configs = configs;
        return output;
    }

    static createOutputsFromChannel(channel: ChannelWithRelations): Output<ConfigInstance>[] {
        if (!channel.outputs || channel.outputs.length === 0) {
            throw new Error(`No output integrations found for channel: ${channel.id}`);
        }

        // Group configs by type
        const configsByType = new Map<OutputConfigType, ChannelOutputWithConfigs[]>();
        for (const outputIntegration of channel.outputs) {
            const configType = outputIntegration.config_type as OutputConfigType;
            if (!configsByType.has(configType)) {
                configsByType.set(configType, []);
            }
            configsByType.get(configType)!.push(outputIntegration as ChannelOutputWithConfigs);
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

        return outputs;
    }

    /**
     * Gets available tools for a list of output config types.
     * Returns only writable tools (isReadOnly: false) since those are the ones that can require approval.
     */
    static getAvailableToolsForOutputTypes(outputTypes: OutputConfigType[]): Array<{
        name: string;
        displayName: string;
        integration: string;
        isReadOnly: boolean;
    }> {
        const tools: Array<{
            name: string;
            displayName: string;
            integration: string;
            isReadOnly: boolean;
        }> = [];
        const seenToolNames = new Set<string>();

        for (const outputType of outputTypes) {
            const output = this.createOutput(outputType);
            if (!output) {
                continue;
            }

            for (const entry of output.toolbox) {
                // Only include writable tools (those that can require approval)
                if (!entry.isReadOnly && !seenToolNames.has(entry.tool.name)) {
                    tools.push({
                        name: entry.tool.name,
                        displayName: entry.displayName,
                        integration: entry.integration,
                        isReadOnly: entry.isReadOnly,
                    });
                    seenToolNames.add(entry.tool.name);
                }
            }
        }

        return tools;
    }
}