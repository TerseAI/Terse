import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { db } from "../../prismaClient"
import { SlackOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { slackSendMessageTool } from "./tools/sendMessage"

export class SlackOutput extends Output<SlackOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [{ tool: slackSendMessageTool as Tool, isReadOnly: false, integration: IntegrationType.SLACK, displayName: "Send message" }]
        super(OutputConfigType.SLACK_CHANNEL, toolbox)
    }

    async validateConfig(output: SlackOutputConfig, _userId: string): Promise<void> {
        if (!output.channelId && !output.userId) {
            throw new Error("Invalid output config for slack_output: missing channelId or userId")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: SlackOutputConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_output_id: channelOutputId,
                channel_id: output.channelId || null,
                channel_name: output.channelName || null,
                listen_to_user_dms: false, // Not applicable for outputs
                user_ids: output.userId ? [output.userId] : [] // Store DM target user if specified
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Slack configs provided")
        }

        const sections: string[] = []

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            if (!config.slack_config) {
                throw new Error("Slack config not found")
            }
            const channelId = config.slack_config.channel_id
            const channelName = config.slack_config.channel_name
            const userIds = config.slack_config.user_ids || []

            if (channelId) {
                configList.push(`  • Integration ID: ${config.integration_id} - Channel Name: ${channelName || "N/A"}, Channel ID: ${channelId}`)
            } else if (userIds.length > 0) {
                configList.push(`  • Integration ID: ${config.integration_id} - DM Target User ID: ${userIds[0]}`)
            }
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Slack tools, you MUST include the `integrationId` parameter matching one of the configurations listed above.")
        sections.push("Use `channelId` for channel messages, or `userId` for direct messages, as configured above.")
        sections.push("\n" + SLACK_OUTPUT_INSTRUCTIONS)

        return sections.join("\n")
    }
}

const SLACK_OUTPUT_INSTRUCTIONS = `
=== SLACK OUTPUT ===

TOOL:
- slack_send_message: Send messages to Slack channels or direct messages (DMs). Supports plain text (mrkdwn) or Block Kit (buttons, structured layouts).

TARGETING:
- Channel: Use \`channelId\` parameter to send to a specific channel
- Direct Message: Use \`userId\` parameter to send a DM to a specific user. The tool will automatically open a DM conversation.
- Note: Provide either \`channelId\` OR \`userId\`, not both.

MESSAGE TYPES:
- Plain text: Simple notifications, short updates. Use \`message\` parameter only.
- Block Kit: Interactive buttons, structured data, reports. Use \`message\` (fallback) + \`blocks\` (JSON array).

WHEN TO USE:
- Plain text → Simple notifications, short updates, no interactive elements needed
- Block Kit → Need buttons (e.g., dashboard links), structured data/metrics, better visual organization

FORMATTING (mrkdwn):
*bold* _italic_ \`code\` \`\`\`code block\`\`\` <url|text> • bullets

THREAD REPLIES:
- When sending a message, the tool returns a \`thread_ts\` value in the result
- To reply in the same thread, use the \`thread_ts\` from the previous message's result as the \`thread_ts\` parameter in your next message
- The \`thread_ts\` represents the root message timestamp of the thread - use it consistently for all replies in that thread
- If no \`thread_ts\` is provided, a new thread is started (the returned \`thread_ts\` will be the new message's timestamp)

BEST PRACTICES:
- Always provide \`message\` (fallback text for Block Kit)
- No calls to action (user can't respond)
- Keep concise and actionable
- Include relevant links
- For thread conversations, always use the \`thread_ts\` from previous message results to maintain thread context
`.trim()
