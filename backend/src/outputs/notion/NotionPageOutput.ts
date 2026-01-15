
import { Tool } from "@openai/agents";
import { ChannelNotionPageConfig, ChannelOutput, NotionIntegration, PrismaTransaction, User } from "../../types/prisma";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { NotionPageConfig } from "../../shared/Configs";
import { notionQueryPageTool, notionModifyBlocksTool, fetchRelatedEventsTool } from "./tools";
import { IntegrationType } from "../../shared/Integrations";
import { NotionIntegrationManager } from "../../integrations/NotionIntegration";
import logger from "../../logger";

export interface NotionPageSession extends Session {
    notionIntegration: NotionIntegration; // Top level integration record
    notionPageConfig: ChannelNotionPageConfig; // Configuration for the Specific Notion Page
}

export class NotionPageOutput extends Output<NotionPageSession, NotionPageConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionQueryPageTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION },
            { tool: notionModifyBlocksTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION },
            { tool: fetchRelatedEventsTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION },
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

        const manager = new NotionIntegrationManager();
        const accessToken = await manager.getAccessToken(integration.id);
        if (!accessToken) {
            logger.error("Failed to fetch Notion access token for page output", {
                integrationId: integration.id,
                userId: user.id,
                workspaceId: integration.workspace_id,
            });
            throw new Error(`Notion integration ${integrationId} could not provide an access token`);
        }

        return {
            notionIntegration: {
                ...integration,
                integration_token: accessToken,
            },
            notionPageConfig: notionPageConfig,
            user: user,
            isUserInitiated: true,
        };
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

    getSystemInstructions(_session: NotionPageSession): string {
        return NOTION_PAGE_FOOTER_INSTRUCTIONS;
    }
}

// MARK: - Footer Instructions

const NOTION_PAGE_FOOTER_INSTRUCTIONS = `
## TERSE FOOTER REQUIREMENT

You MUST always ensure a **Terse Footer** exists at the very bottom of the Notion page after any update. This footer provides transparency about when and how the page was last updated by Terse.

**IMPORTANT**: If the user provides custom footer formatting instructions in their USER_INSTRUCTIONS, use their format instead of the default format below. User instructions take precedence.

### Default Footer Format
The footer consists of two blocks:
1. **Divider block** - to visually separate the footer from main content
2. **Heading 3 block** - with the following format:

\`Updated by Terse 🫶 • Last sync: Dec 6, 2025 • Based on 7 events\`

Where:
- "Terse" should be a clickable link to https://useterse.ai
- The date should be formatted as "Mon D, YYYY" (e.g., "Dec 6, 2025")
- The event count should use the event position number from the RUNTIME CONTEXT section (e.g., "3" if RUNTIME CONTEXT says "This is event #3")

### Example using the modify blocks tool:
\`\`\`json
[
  { "type": "divider", "divider": {} },
  { 
    "type": "heading_3", 
    "heading_3": { 
      "rich_text": [
        { "type": "text", "text": { "content": "Updated by " } },
        { "type": "text", "text": { "content": "Terse", "link": { "url": "https://useterse.ai" } } },
        { "type": "text", "text": { "content": " 🫶 • Last sync: Dec 6, 2025 • Based on 7 events" } }
      ] 
    } 
  }
]
\`\`\`

### Important Rules
- If a Terse footer already exists (identified by text starting with "Updated by Terse" or matching user's custom format), UPDATE it with the new values rather than creating a duplicate
- The footer must ALWAYS be at the very end of the page content
- Use the bullet separator (•) between each metadata item (unless user specifies otherwise)
- **CRITICAL**: For the event count, use the event position number from the RUNTIME CONTEXT section (e.g., if it says "This is event #3 processed by this automation", use "3 events"). DO NOT count the individual events in the EVENT block - use the total event position from RUNTIME CONTEXT.
`.trim();
