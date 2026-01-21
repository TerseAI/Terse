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
        [OutputConfigType.SLACK_CHANNEL, () => new SlackOutput()]
    ]);

    /**
     * Create an Output instance for the given integration type.
     * @param integrationType The integration type to create an output for
     * @returns An Output instance, or null if the integration type is not supported
     */
    static createOutput(integrationType: OutputConfigType): Output<ConfigInstance> | null {
        const factory = this.OUTPUT_REGISTRY.get(integrationType);
        if (!factory) {
            return null;
        }
        return factory();
    }

    /**
     * Create an Output instance for the given integration type with configs attached.
     * @param configType The integration type to create an output for
     * @param configs Array of channel output configs for this output type
     * @returns An Output instance with configs set, or null if the integration type is not supported
     */
    static createOutputWithConfigs(configType: OutputConfigType, configs: ChannelOutputWithConfigs[]): Output<ConfigInstance> | null {
        const output = this.createOutput(configType);
        if (!output) {
            return null;
        }
        output.configs = configs;
        return output;
    }

    /**
     * Create Output instances from a channel's output configurations.
     * Groups configs by type and creates one instance per type with all configs of that type.
     * @param channel Channel with outputs relation loaded
     * @returns Array of Output instances, one per unique output type
     * @throws Error if no outputs found or if an output type is not supported
     */
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
     * Check if an integration type is supported as an output.
     * @param integrationType The integration type to check
     * @returns true if the integration type is supported as an output
     */
    static isSupported(integrationType: OutputConfigType): boolean {
        return this.OUTPUT_REGISTRY.has(integrationType);
    }
}