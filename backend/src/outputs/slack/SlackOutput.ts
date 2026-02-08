import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { slackListUsersTool } from "../../knowledgeBase/slack/tools/listUsers"
import { SlackOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

import { slackSendMessageTool } from "./tools/sendMessage"

export class SlackOutput extends Output<SlackOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: slackSendMessageTool as Tool, isReadOnly: false, integration: IntegrationType.SLACK, displayName: "Send message" },
            { tool: slackListUsersTool as Tool, isReadOnly: true, integration: IntegrationType.SLACK, displayName: "List users" }
        ]
        super(OutputConfigType.SLACK_CHANNEL, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.SLACK_CHANNEL)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "Slack integration connection",
                channelId: "Slack channel or DM channel ID",
                channelName: "Channel display name",
                userIds: "Slack user IDs for DMs (when sending to DMs instead of channel)"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.SLACK_CHANNEL,
            slack_config: {
                channel_id: "C123",
                channel_name: "Example Channel",
                user_ids: []
            }
        })
    }

    async validateConfig(output: SlackOutputConfig, _userId: string): Promise<void> {
        const hasChannel = !!(output.channelId && output.channelId.trim())
        const hasUsers = (output.userIds?.length ?? 0) > 0
        if (!hasChannel && !hasUsers) {
            throw new Error("Invalid output config for slack_output: provide either channelId or at least one userId (for DMs)")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: SlackOutputConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_output_id: channelOutputId,
                channel_id: output.channelId || null,
                channel_name: output.channelName || null,
                listen_to_user_dms: false, // Not applicable for outputs
                user_ids: output.userIds ?? []
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Slack configs provided")
        }

        const configList: string[] = []
        for (const config of configs) {
            if (!config.slack_config) throw new Error("Slack config not found")
            const channelId = config.slack_config.channel_id
            const channelName = config.slack_config.channel_name
            const userIds = config.slack_config.user_ids ?? []
            if (channelId) {
                configList.push(`  • Integration ID: ${config.integration_id} - Channel ID: ${channelId}${channelName ? ` (${channelName})` : ""}`)
            }
            if (userIds.length > 0) {
                configList.push(`  • Integration ID: ${config.integration_id} - User IDs for DMs: ${userIds.join(", ")}`)
            }
        }

        if (configList.length === 0) {
            throw new Error("No Slack output destinations (channel or user IDs for DMs).")
        }

        const sections: string[] = []
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Slack tools, you MUST include the `integrationId` and `channelId` parameters matching one of the configurations listed above.")
        sections.push("\nUse slack_list_users to resolve Slack user IDs to names when needed.")
        sections.push("\n" + SLACK_OUTPUT_INSTRUCTIONS)
        return sections.join("\n")
    }
}

const SLACK_OUTPUT_INSTRUCTIONS = `
=== SLACK OUTPUT ===

TOOLS:
- slack_send_message: Send messages to Slack channels or DMs. Use channelId from the listed configurations. Supports plain text (mrkdwn) or Block Kit (buttons, structured layouts).
- slack_list_users: List workspace users (id and name). Use to resolve user IDs to names when needed.

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
