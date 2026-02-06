import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { WebClient } from "@slack/web-api"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { SlackOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { slackSendMessageTool } from "./tools/sendMessage"

interface ResolvedSlackDestination {
    integrationId: string
    channelId: string
    channelName: string
}

export class SlackOutput extends Output<SlackOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [{ tool: slackSendMessageTool as Tool, isReadOnly: false, integration: IntegrationType.SLACK, displayName: "Send message" }]
        super(OutputConfigType.SLACK_CHANNEL, toolbox)
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

    override async getSystemInstructions(): Promise<string> {
        const destinations = await this.resolveDestinations(this.configs)
        return this.buildInstructionsFromDestinations(destinations)
    }

    private async resolveDestinations(configs: AgentOutputWithConfigs[]): Promise<ResolvedSlackDestination[]> {
        const destinations: ResolvedSlackDestination[] = []

        for (const config of configs) {
            if (!config.slack_config) continue

            const integrationId = config.integration_id
            const channelId = config.slack_config.channel_id
            const channelName = config.slack_config.channel_name
            const userIds = config.slack_config.user_ids ?? []

            if (channelId) {
                destinations.push({
                    integrationId,
                    channelId,
                    channelName: channelName || channelId
                })
            }

            if (userIds.length > 0) {
                const dmChannels = await this.resolveUserIdsToDmChannels(integrationId, userIds)
                destinations.push(...dmChannels)
            }
        }

        return destinations
    }

    private async resolveUserIdsToDmChannels(integrationId: string, userIds: string[]): Promise<ResolvedSlackDestination[]> {
        const usi = await db().user_slack_integrations.findUnique({
            where: { id: integrationId },
            include: { slack_integration: true }
        })
        if (!usi?.slack_integration) {
            logger.warn("[SlackOutput] Integration not found for DM resolution", { integrationId })
            return []
        }

        const token = usi.authed_user_access_token || usi.slack_integration.access_token
        if (!token) {
            logger.warn("[SlackOutput] No token for integration", { integrationId })
            return []
        }

        const client = new WebClient(token)
        const results: ResolvedSlackDestination[] = []

        for (const userId of userIds) {
            try {
                const { channel } = await client.conversations.open({ users: userId })
                const id = (channel as { id?: string })?.id
                if (id) {
                    let name = `DM with ${userId}`
                    try {
                        const userInfo = await client.users.info({ user: userId })
                        const user = (userInfo as { user?: { real_name?: string; name?: string } }).user
                        if (user) name = `DM with ${user.real_name || user.name || userId}`
                    } catch {
                        // keep default name
                    }
                    results.push({ integrationId, channelId: id, channelName: name })
                }
            } catch (err) {
                logger.warn("[SlackOutput] Failed to open DM channel", { integrationId, userId, error: err })
            }
        }

        return results
    }

    private buildInstructionsFromDestinations(destinations: ResolvedSlackDestination[]): string {
        if (destinations.length === 0) {
            throw new Error("No Slack output destinations provided")
        }

        const configList = destinations.map(
            d => `  • Integration ID: ${d.integrationId} - Channel Name: ${d.channelName}, Channel ID: ${d.channelId}`
        )
        const sections: string[] = []
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Slack tools, you MUST include the `integrationId` and `channelId` parameters matching one of the configurations listed above.")
        sections.push("\n" + SLACK_OUTPUT_INSTRUCTIONS)
        return sections.join("\n")
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Slack configs provided")
        }

        const destinations: ResolvedSlackDestination[] = []
        for (const config of configs) {
            if (!config.slack_config) throw new Error("Slack config not found")
            const channelId = config.slack_config.channel_id
            if (channelId) {
                destinations.push({
                    integrationId: config.integration_id,
                    channelId,
                    channelName: config.slack_config.channel_name || channelId
                })
            }
        }

        if (destinations.length === 0) {
            throw new Error("No Slack output destinations (channel or resolved DMs). Use getSystemInstructions() when configs include user_ids.")
        }

        return this.buildInstructionsFromDestinations(destinations)
    }
}

const SLACK_OUTPUT_INSTRUCTIONS = `
=== SLACK OUTPUT ===

TOOL:
- slack_send_message: Send messages to Slack channels or DMs. Use channelId from the listed configurations (includes resolved DM channel IDs when destination is users). Supports plain text (mrkdwn) or Block Kit (buttons, structured layouts).

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
