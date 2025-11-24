import { Output, ToolboxEntry } from "../abstract/Output";
import { Tool } from "@openai/agents";
import { Session } from "../../server";
import { NotionIntegration, ChannelOutput, User, ChannelNotionConfig, PrismaTransaction } from "../../types/prisma";
import { db } from "../../prismaClient";
import { IntegrationType } from "../../shared/Integrations";
import { NotionConfig } from "../../shared/Configs";
import { OutputConfigType } from "@prisma/client";
import { notionQueryDatabaseTool, notionModifyPageTool } from "./tools";

export interface NotionDatabaseSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionConfig: ChannelNotionConfig; // Configuration for the Specific Notion Database
}

export class NotionDatabaseOutput extends Output<NotionDatabaseSession, NotionConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionQueryDatabaseTool as Tool, isReadOnly: true },
            { tool: notionModifyPageTool as Tool, isReadOnly: false },
        ];
        super(OutputConfigType.NOTION_DATABASE, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        channelOutputConfig: ChannelOutput,
        user: User
    ): Promise<NotionDatabaseSession> {
        // NotionOutput knows how to fetch its own integration
        const integration = await db().notion_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Notion integration ${integrationId} not found`);
        }

        const notionConfig: ChannelNotionConfig | null = await db().automation_notion_configs.findFirst({
            where: { automation_output_id: channelOutputConfig.id }
        });

        if (!notionConfig) {
            throw new Error(`Notion config for channel output ${channelOutputConfig.id} not found`);
        }

        return {
            notionIntegration: integration,
            notionConfig: notionConfig,
            user: user,
            isUserInitiated: true,
            // Collect actions from tools; will be persisted after run
            runActions: [],
        };
    }
    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: NotionConfig): Promise<void> {
        await tx.automation_notion_configs.create({
            data: {
                automation_output_id: channelOutputId,
                database_id: output.databaseId || '',
                database_name: output.databaseName || '',
            },
        });
    }
}

