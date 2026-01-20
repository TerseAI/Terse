// MARK: - Output Integrations

import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { ToolboxEntry } from "../../outputs/abstract/Output";

export abstract class KnowledgeBase<KBConfig extends ConfigInstance> {
    integration: KnowledgeBaseConfigType;
    readonly toolbox: readonly ToolboxEntry[];

    constructor(integration: KnowledgeBaseConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...toolbox]
    }

    abstract validateConfig(knowledgeBase: KBConfig, userId: string): Promise<void>;

    abstract addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: KBConfig): Promise<void>;

    /**
     * Returns output-specific system instructions that will be appended to the base system prompt.
     * Override this method in subclasses to provide output-specific guidance.
     * @param configs Array of configuration objects, each containing integrationId and channelKnowledgeBase with all config relations loaded.
     *                 All configs of this knowledge base type will be provided so the AI can choose which to use for each tool call.
     * @returns Additional system instructions as a string
     */
    abstract getSystemInstructions(configs: Array<{ integrationId: string, channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs }>): string;

    /**
     * Formats this knowledge base configuration for the "Available Configurations" section of the system prompt.
     * Each knowledge base type knows how to format its own details.
     * @param config Configuration object with integrationId and channelKnowledgeBase
     * @returns Formatted string like "Integration ID: X, Type: Y, Details: Z"
     */
    abstract formatForAvailableConfigurationsSection(config: { integrationId: string, channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs }): string;
}