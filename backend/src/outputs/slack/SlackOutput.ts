import { Tool } from "@openai/agents";
import { ChannelOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { SlackOutputConfig } from "../../shared/Configs";
import { slackSendMessageTool } from "./tools/sendMessage";
import { IntegrationType } from "../../shared/Integrations";

export class SlackOutput extends Output<SlackOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: slackSendMessageTool as Tool, isReadOnly: false, integration: IntegrationType.SLACK },
        ];
        super(OutputConfigType.SLACK_CHANNEL, toolbox);
    }


    async validateConfig(output: SlackOutputConfig, _userId: string): Promise<void> {
        if (!output.channelId) {
            throw new Error('Invalid output config for slack_output: missing channelId');
        }
    }

    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: SlackOutputConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_output_id: channelOutputId,
                channel_id: output.channelId || null,
                channel_name: output.channelName || null,
                listen_to_user_dms: false, // Not applicable for outputs
                user_ids: [], // Not applicable for outputs
            },
        });
    }

    getSystemInstructions(configs: ChannelOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No Slack configs provided');
        }
        
        const sections: string[] = [];
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.slack_config) {
                throw new Error('Slack config not found');
            }
            const channelId = config.slack_config.channel_id;
            const channelName = config.slack_config.channel_name;
            configList.push(`  • Integration ID: ${config.integration_id} - Channel: ${channelName || channelId}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling Slack tools, you MUST include the `integrationId` and `channelId` parameters matching one of the configurations listed above.');
        sections.push('\n' + SLACK_OUTPUT_INSTRUCTIONS);
        
        return sections.join('\n');
    }

    formatForAvailableConfigurationsSection(config: { integrationId: string, channelOutput: ChannelOutputWithConfigs }): string {
        const { integrationId, channelOutput } = config;
        if (!channelOutput.slack_config) {
            throw new Error('Slack config not found');
        }
        const channelName = channelOutput.slack_config.channel_name;
        const channelId = channelOutput.slack_config.channel_id;
        const details = channelName ? `Channel: ${channelName}` : (channelId ? `Channel: ${channelId}` : '');
        return `Integration ID: ${integrationId}, Type: ${channelOutput.config_type}${details ? `, ${details}` : ''}`;
    }
}

const SLACK_OUTPUT_INSTRUCTIONS = `
=== SLACK OUTPUT ===

TOOL:
- slack_send_message: Send messages to Slack channel. Supports plain text (mrkdwn) or Block Kit (buttons, structured layouts).

MESSAGE TYPES:
- Plain text: Simple notifications, short updates. Use \`message\` parameter only.
- Block Kit: Interactive buttons, structured data, reports. Use \`message\` (fallback) + \`blocks\` (JSON array).

WHEN TO USE:
- Plain text → Simple notifications, short updates, no interactive elements needed
- Block Kit → Need buttons (e.g., dashboard links), structured data/metrics, better visual organization

FORMATTING (mrkdwn):
*bold* _italic_ \`code\` \`\`\`code block\`\`\` <url|text> • bullets

BEST PRACTICES:
- Always provide \`message\` (fallback text for Block Kit)
- No calls to action (user can't respond)
- Keep concise and actionable
- Include relevant links
`.trim();
