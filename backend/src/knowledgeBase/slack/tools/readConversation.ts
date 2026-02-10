import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { initializeSlackWebClient } from "../../../integrations/SlackClient"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const slackReadConversationTool = tool({
    name: ToolName.SLACK_READ_CONVERSATION,
    description: `Read message history from a Slack channel or DM.
Use the channel ID from slack_list_channels. Supports public channels, private channels, and DMs.
Supports pagination: if the response includes nextCursor and hasMore, pass nextCursor as the cursor parameter on the next call to fetch more messages.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
        channelId: z.string().describe("The Slack channel ID to read (from slack_list_channels)."),
        limit: z.number().min(1).max(200).nullable().optional().default(50).describe("Maximum number of messages to return."),
        cursor: z.string().nullable().optional().describe("Pagination cursor from a previous response (nextCursor). Omit on first call.")
    }),
    execute: async ({ integrationId, channelId, limit = 50, cursor }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing slack_read_conversation tool", { integrationId, channelId, limit })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user?.organizationId
        if (!organizationId) {
            throw new Error("Organization context required")
        }

        try {
            const userSlackIntegration = await db().user_slack_integrations.findFirst({
                where: {
                    id: integrationId,
                    organization_id: organizationId
                },
                include: {
                    slack_integration: true,
                    user: true
                }
            })

            if (!userSlackIntegration) {
                return {
                    success: false,
                    error: `Slack integration not found or access denied: ${integrationId}`,
                    hint: "Ensure the integration ID is correct and belongs to your account."
                }
            }

            const client = initializeSlackWebClient(userSlackIntegration)
            const params = {
                channel: channelId,
                limit: limit ?? undefined,
                ...(cursor && { cursor })
            }

            const result = await client.conversations.history(params)

            const rawMessages = result.messages ?? []

            const messages = await Promise.all(
                rawMessages.map(async (msg: { user?: string; text?: string; ts?: string; thread_ts?: string; bot_id?: string }) => {
                    let userName: string | undefined
                    if (msg.user) {
                        try {
                            const userInfo = await client.users.info({ user: msg.user })
                            userName = (userInfo.user as { real_name?: string; name?: string })?.real_name ?? (userInfo.user as { real_name?: string; name?: string })?.name
                        } catch {
                            userName = msg.user
                        }
                    } else if (msg.bot_id) {
                        userName = "Bot"
                    }

                    return {
                        userId: msg.user,
                        userName,
                        text: msg.text ?? "",
                        timestamp: msg.ts,
                        threadTs: msg.thread_ts
                    }
                })
            )

            let channelName: string | undefined
            try {
                const channelInfo = await client.conversations.info({ channel: channelId })
                const ch = channelInfo.channel as { name?: string; is_im?: boolean; user?: string } | undefined
                if (ch?.is_im && ch?.user) {
                    try {
                        const userInfo = await client.users.info({ user: ch.user })
                        channelName = (userInfo.user as { real_name?: string; name?: string })?.real_name ?? `DM`
                    } catch {
                        channelName = `DM (${ch.user})`
                    }
                } else {
                    channelName = ch?.name ? `#${ch.name}` : channelId
                }
            } catch {
                channelName = channelId
            }

            const action = {
                action: "Read conversation",
                integration: IntegrationType.SLACK,
                target: channelName ?? channelId,
                details: `${messages.length} message(s)`,
                type: RunHistoryActionType.read
            }

            const hasMore = (result as { has_more?: boolean }).has_more ?? false
            const nextCursor = (result as { response_metadata?: { next_cursor?: string } }).response_metadata?.next_cursor ?? null
            return {
                success: true,
                channelId,
                channelName,
                messages,
                count: messages.length,
                hasMore,
                nextCursor,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error reading Slack conversation", { error: errorMessage, integrationId, channelId })
            const hint =
                (error as { data?: { error?: string } })?.data?.error === "not_in_channel"
                    ? "The app or user is not in this channel. Join the channel first or use a channel the integration can access."
                    : "Check that the integration has channels:history, groups:history, im:history, mpim:history scopes and is in the channel."
            return {
                success: false,
                error: errorMessage,
                hint
            }
        }
    },
    errorFunction: formatError
})
