import { Tool, webSearchTool } from "@openai/agents";
import { Session } from "../../server";
import { ChannelOutput, PrismaTransaction, User } from "../../types/prisma";
import { OutputConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";

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

    abstract validateConfig(output: TConfig, userId: string): Promise<void>;

    abstract addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: TConfig): Promise<void>;

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