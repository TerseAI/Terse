// MARK: - Output Integrations

import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { ToolboxEntry } from "../../outputs/abstract/Output";

export abstract class KnowledgeBase<KBConfig extends ConfigInstance> {
    integration: KnowledgeBaseConfigType;
    readonly toolbox: readonly ToolboxEntry[];
    configs: ChannelKnowledgeBaseWithConfigs[] = [];

    constructor(integration: KnowledgeBaseConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...toolbox]
    }

    abstract validateConfig(knowledgeBase: KBConfig, userId: string): Promise<void>;

    abstract addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: KBConfig): Promise<void>;

    /**
     * Returns system instructions for this knowledge base.
     * Uses the configs property that should be set when the instance is created.
     */
    getSystemInstructions(): string {
        return this.getSystemInstructionsForConfigs(this.configs);
    }

    /**
     * Protected method that subclasses implement to generate system instructions.
     * This maintains the existing signature for subclasses.
     * @param configs Array of configuration objects, each containing integrationId and channelKnowledgeBase with all config relations loaded.
     *                 All configs of this knowledge base type will be provided so the AI can choose which to use for each tool call.
     * @returns Additional system instructions as a string
     */
    protected abstract getSystemInstructionsForConfigs(configs: ChannelKnowledgeBaseWithConfigs[]): string;
}