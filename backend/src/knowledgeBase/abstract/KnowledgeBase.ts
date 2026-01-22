// MARK: - Output Integrations

import { AgentKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { ToolboxEntry } from "../../outputs/abstract/Output";

export abstract class KnowledgeBase<KBConfig extends ConfigInstance> {
    integration: KnowledgeBaseConfigType;
    readonly toolbox: readonly ToolboxEntry[];
    configs: AgentKnowledgeBaseWithConfigs[] = [];

    constructor(integration: KnowledgeBaseConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...toolbox]
    }

    abstract validateConfig(knowledgeBase: KBConfig, userId: string): Promise<void>;

    abstract addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: KBConfig): Promise<void>;


    getSystemInstructions(): string {
        return this.getSystemInstructionsForConfigs(this.configs);
    }

    protected abstract getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string;
}
