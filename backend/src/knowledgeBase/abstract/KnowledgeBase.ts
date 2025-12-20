// MARK: - Output Integrations

import { Session } from "../../server";
import { ChannelKnowledgeBase, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { ToolboxEntry } from "../../outputs/abstract/Output";

export abstract class KnowledgeBase<T extends Session, KBConfig extends ConfigInstance> {
    integration: KnowledgeBaseConfigType;
    readonly toolbox: readonly ToolboxEntry[];

    constructor(integration: KnowledgeBaseConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...toolbox]
    }

    abstract createSessionFromConfig(
        integrationId: string, // Integration ID to fetch from database
        channelKnowledgeBase: ChannelKnowledgeBase | null, // ChannelOutput with loaded config relations
        user: User
    ): Promise<T>;

    abstract addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: KBConfig): Promise<void>;

    /**
     * Returns output-specific system instructions that will be appended to the base system prompt.
     * Override this method in subclasses to provide output-specific guidance.
     * @param session The session context
     * @returns Additional system instructions as a string
     */
    getSystemInstructions(session: T): string {
        return '';
    }
}