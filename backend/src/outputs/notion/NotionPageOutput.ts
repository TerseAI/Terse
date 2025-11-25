
import { Tool } from "@openai/agents";
import { ChannelNotionPageConfig, ChannelOutput, NotionIntegration, PrismaTransaction, User } from "../../types/prisma";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { NotionPageConfig } from "../../shared/Configs";
import { notionQueryPageTool, notionModifyBlocksTool } from "./tools";
import { IntegrationType } from "../../shared/Integrations";

export interface NotionPageSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionPageConfig: ChannelNotionPageConfig; // Configuration for the Specific Notion Page
}

export class NotionPageOutput extends Output<NotionPageSession, NotionPageConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionQueryPageTool as Tool, isReadOnly: true },
            { tool: notionModifyBlocksTool as Tool, isReadOnly: false },
        ];
        super(OutputConfigType.NOTION_PAGE, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        channelOutputConfig: ChannelOutput,
        user: User
    ): Promise<NotionPageSession> {
        const integration = await db().notion_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Notion integration ${integrationId} not found`);
        }

        const notionPageConfig: ChannelNotionPageConfig | null = await db().automation_notion_page_configs.findFirst({
            where: { automation_output_id: channelOutputConfig.id }
        });

        if (!notionPageConfig) {
            throw new Error(`Notion page config for automation output ${channelOutputConfig.id} not found`);
        }

        return { notionIntegration: integration, notionPageConfig: notionPageConfig, user: user, isUserInitiated: true };
    }

    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: NotionPageConfig): Promise<void> {
        await tx.automation_notion_page_configs.create({
            data: {
                automation_output_id: channelOutputId,
                page_id: output.pageId || '',
                page_name: output.pageName || '',
            },
        });
    }
}
