// MARK: - Output Integrations

import { Tool, webSearchTool } from "@openai/agents";
import { Session } from "../../server";
import { ChannelOutput, PrismaTransaction, User } from "../../types/prisma";
import { OutputConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
// You can only have one output at a time. Basically, it's just a specific integration + a toolbox to modify the content.
// For Notion, we should support multiple integrations with the same account. 

export interface ToolboxEntry {
    tool: Tool;
    isReadOnly: boolean;
    integration: IntegrationType;
}

export abstract class Output<T extends Session, TConfig extends ConfigInstance> {
    integration: OutputConfigType;
    readonly toolbox: readonly ToolboxEntry[];

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...defaultToolbox, ...toolbox] 
    }

    abstract createSessionFromConfig(
        integrationId: string, // Integration ID to fetch from database
        channelOutputConfig: ChannelOutput, // ChannelOutput with loaded config relations
        user: User
    ): Promise<T>;

    abstract addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: TConfig): Promise<void>;

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

export const defaultToolbox: readonly ToolboxEntry[] = [
    {
        tool: webSearchTool({
            searchContextSize: 'medium',
        }),
        isReadOnly: true,
        integration: IntegrationType.TERSE
    }
]