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


    getSystemInstructions(): string {
        return this.getSystemInstructionsForConfigs(this.configs);
    }

    protected abstract getSystemInstructionsForConfigs(configs: ChannelKnowledgeBaseWithConfigs[]): string;
}