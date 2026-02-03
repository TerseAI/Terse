import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { KnownBlock, WebClient } from "@slack/web-api"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"
import { isValidEpochTimestamp } from "../../../utility/strings"

/**
 * Tool for sending messages to Slack channels or DMs.
 * Messages are sent as the Terse bot.
 */
export const slackSendMessageTool = tool({
    name: ToolName.SLACK_SEND_MESSAGE,
    description: `Send message to Slack channel. Supports plain text (mrkdwn) or Block Kit (JSON blocks).`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Slack workspace to use."),
        channelId: z.string().describe("The Slack channel ID to send the message to."),
        message: z.string().describe("Message content (mrkdwn). Used as fallback for Block Kit or main message."),
        thread_ts: z
            .string()
            .nullable()
            .optional()
            .describe(
                "Thread timestamp to reply to existing thread. If sending a message to a thread, this should be the timestamp of the thread to reply to. If sending an unthreaded message, this should be set to null."
            ),
        blocks: z.string().nullable().optional().describe("Block Kit JSON array string for interactive messages with buttons, structured layouts")
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.SLACK_SEND_MESSAGE),
    execute: async ({ integrationId, channelId, message, thread_ts, blocks: blocksJson }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        // Parse and validate Block Kit blocks if provided
        let blocks: KnownBlock[] | undefined
        if (blocksJson) {
            try {
                const parsed = JSON.parse(blocksJson)
                if (!Array.isArray(parsed)) {
                    throw new Error("Blocks must be a JSON array")
                }
                // Basic validation: ensure each block has a type
                for (const block of parsed) {
                    if (!block || typeof block !== "object" || !block.type) {
                        throw new Error("Each block must be an object with a 'type' property")
                    }
                }
                blocks = parsed as KnownBlock[]
            } catch (error: any) {
                logger.error(`[Slack Output] Invalid Block Kit JSON`, {
                    error: error.message,
                    blocksJson: blocksJson.substring(0, 200) // Log first 200 chars for debugging
                })
                throw new Error(`Invalid Block Kit JSON: ${error.message}. Blocks must be a valid JSON array of Block Kit blocks.`)
            }
        }

        try {
            // Get user slack integration to find team_id
            const userSlackIntegration = await db().user_slack_integrations.findUnique({
                where: { id: integrationId },
                include: {
                    slack_integration: true
                }
            })

            if (!userSlackIntegration) {
                throw new Error(`Slack integration not found: ${integrationId}`)
            }

            // Get the workspace token
            const slackIntegration = await db().slack_integrations.findFirst({
                where: {
                    team_id: userSlackIntegration.slack_team_id
                }
            })

            if (!slackIntegration) {
                throw new Error(`Slack workspace integration not found for team ${userSlackIntegration.slack_team_id}`)
            }

            const client = new WebClient(slackIntegration.access_token)

            // Get channel name from API
            let channelName = channelId // fallback to channelId
            try {
                const channelInfo = await client.conversations.info({ channel: channelId })
                if (channelInfo.channel) {
                    const channel = channelInfo.channel as { name?: string; is_im?: boolean; user?: string }
                    if (channel.is_im && channel.user) {
                        // For DMs, try to get the user's name
                        try {
                            const userInfo = await client.users.info({ user: channel.user })
                            if (userInfo.user) {
                                channelName = userInfo.user.real_name || userInfo.user.name || `DM with ${channel.user}`
                            }
                        } catch (userError) {
                            channelName = `DM with ${channel.user}`
                        }
                    } else if (channel.name) {
                        // For channels, prefix with #
                        channelName = `#${channel.name}`
                    }
                }
            } catch (error) {
                logger.warn("Failed to fetch Slack channel info for channel name", { error, channelId })
                // Keep channelName as channelId fallback
            }

            let validThreadTs
            if (thread_ts && thread_ts.length > 0) {
                if (isValidEpochTimestamp(thread_ts)) {
                    validThreadTs = thread_ts
                } else {
                    logger.warn("Invalid thread timestamp", { thread_ts })
                }
            } else {
                validThreadTs = undefined
            }

            const result = await client.chat.postMessage({
                channel: channelId,
                text: message,
                blocks: blocks,
                thread_ts: thread_ts || undefined,
                unfurl_links: true,
                unfurl_media: true
            })

            if (!result.ok) {
                throw new Error(`Failed to send message: ${result.error}`)
            }
            const messagePreview = message.length > 100 ? message.substring(0, 100) + "..." : message
            const messageType = blocks ? "Block Kit" : "text"

            // Build Slack message permalink URL
            const messageTs = result.ts?.replace(".", "") || ""
            const slackPermalink = `https://${userSlackIntegration.slack_integration.team_name || "slack"}.slack.com/archives/${channelId}/p${messageTs}`

            // Return action as part of the result
            const action = {
                action: "Sent Slack message",
                integration: IntegrationType.SLACK,
                target: channelName,
                details: `Sent message to ${channelName}${thread_ts ? " (thread reply)" : ""}: "${messagePreview}"`,
                url: slackPermalink,
                type: RunHistoryActionType.create
            }

            logger.debug("[slack_send_message] Returning action in result", {
                userId: runContext?.context?.user?.id || "unknown",
                action
            })

            logger.info(`[Slack Output] Message sent to ${channelName}`, {
                channelId,
                messageTs: result.ts,
                threadTs: thread_ts,
                hasBlocks: !!blocks,
                blocksCount: blocks?.length
            })

            return {
                success: true,
                message_ts: result.ts,
                channel: channelName,
                thread_ts: thread_ts || result.ts,
                summary: `${messageType} message sent to ${channelName}: "${messagePreview}"`,
                has_blocks: !!blocks,
                actions: [action]
            }
        } catch (error: any) {
            logger.error(`[Slack Output] Failed to send message`, {
                error,
                channelId
            })

            // Provide helpful error messages
            if (error.data?.error === "channel_not_found") {
                throw new Error(`Channel not found. The bot may not have access to this channel.`)
            } else if (error.data?.error === "not_in_channel") {
                throw new Error(`The Terse bot is not a member of this channel. Please invite the bot to the channel first.`)
            } else if (error.data?.error === "is_archived") {
                throw new Error(`Cannot send messages to an archived channel.`)
            }

            throw new Error(`Failed to send Slack message: ${error.message || error}`)
        }
    }
})
