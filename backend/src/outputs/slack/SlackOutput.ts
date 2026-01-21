import { Tool } from "@openai/agents";
import { AgentOutput, PrismaTransaction, User, UserSlackIntegration } from "../../types/prisma";
import { automation_slack_configs } from "@prisma/client";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { SlackOutputConfig } from "../../shared/Configs";
import { slackSendMessageTool } from "./tools/sendMessage";
import { IntegrationType } from "../../shared/Integrations";

export interface SlackChannelSession extends Session {
    slackIntegration: UserSlackIntegration; // User's Slack integration record
    slackConfig: automation_slack_configs; // Configuration for the Slack channel/DM
}

export class SlackOutput extends Output<SlackChannelSession, SlackOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: slackSendMessageTool as Tool, isReadOnly: false, integration: IntegrationType.SLACK },
        ];
        super(OutputConfigType.SLACK_CHANNEL, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        agentOutputConfig: AgentOutput,
        user: User
    ): Promise<SlackChannelSession> {
        // For Slack, integrationId is the user_slack_integrations.id
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { 
                id: integrationId,
                user_id: user.id,
            },
            include: {
                slack_integration: true,
            },
        });

        if (!userSlackIntegration) {
            throw new Error(`Slack integration ${integrationId} not found for user`);
        }

        const slackConfigRecord = await db().automation_slack_configs.findFirst({
            where: { automation_output_id: agentOutputConfig.id }
        });

        if (!slackConfigRecord) {
            throw new Error(`Slack config for automation output ${agentOutputConfig.id} not found`);
        }

        return { 
            slackIntegration: userSlackIntegration, 
            slackConfig: slackConfigRecord, 
            user: user, 
            isUserInitiated: true 
        };
    }

    async validateConfig(output: SlackOutputConfig, _userId: string): Promise<void> {
        if (!output.channelId) {
            throw new Error('Invalid output config for slack_output: missing channelId');
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: SlackOutputConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_output_id: agentOutputId,
                channel_id: output.channelId || null,
                channel_name: output.channelName || null,
                listen_to_user_dms: false, // Not applicable for outputs
                user_ids: [], // Not applicable for outputs
            },
        });
    }

    getSystemInstructions(_session: SlackChannelSession): string {
        return SLACK_OUTPUT_INSTRUCTIONS;
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
