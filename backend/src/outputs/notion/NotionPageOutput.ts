
import { Tool } from "@openai/agents";
import { ChannelOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { NotionPageConfig } from "../../shared/Configs";
import { notionQueryPageTool, notionModifyBlocksTool, fetchRelatedEventsTool } from "./tools";
import { IntegrationType } from "../../shared/Integrations";

export class NotionPageOutput extends Output<NotionPageConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: notionQueryPageTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION },
            { tool: notionModifyBlocksTool as Tool, isReadOnly: false, integration: IntegrationType.NOTION },
            { tool: fetchRelatedEventsTool as Tool, isReadOnly: true, integration: IntegrationType.NOTION },
        ];
        super(OutputConfigType.NOTION_PAGE, toolbox);
    }


    async validateConfig(output: NotionPageConfig, _userId: string): Promise<void> {
        if (!output.pageId) {
            throw new Error('Invalid output config for notion_page: missing pageId');
        }
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

    protected getSystemInstructionsForConfigs(configs: ChannelOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No Notion page configs provided');
        }
        
        const sections: string[] = [];
        sections.push('=== NOTION PAGE OUTPUT ===');
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.notion_page_config) {
                throw new Error('Notion page config not found');
            }
            const pageId = config.notion_page_config.page_id;
            const pageName = config.notion_page_config.page_name;
            configList.push(`  • Integration ID: ${config.integration_id} - Page Name: ${pageName || 'N/A'}, Page ID: ${pageId || 'N/A'}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling Notion page tools, you MUST include the `integrationId` and `pageId` parameters matching one of the configurations listed above.');
        sections.push('\n' + NOTION_PAGE_FOOTER_INSTRUCTIONS);
        
        return sections.join('\n');
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

\`Updated by Terse 🫶 • Last sync: Dec 6, 2025 \`

Where:
- "Terse" should be a clickable link to https://useterse.ai
- The date should be formatted as "Mon D, YYYY" (e.g., "Dec 6, 2025")

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
        { "type": "text", "text": { "content": " 🫶 • Last sync: Dec 6, 2025 " } }
      ] 
    } 
  }
]
\`\`\`

### Important Rules
- If a Terse footer already exists (identified by text starting with "Updated by Terse" or matching user's custom format), UPDATE it with the new values rather than creating a duplicate
- The footer must ALWAYS be at the very end of the page content
- Use the bullet separator (•) between each metadata item (unless user specifies otherwise)
`.trim();
