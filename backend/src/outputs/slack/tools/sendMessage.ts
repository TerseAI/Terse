import { RunHistoryActionType } from "@prisma/client"
import { KnownBlock } from "@slack/web-api"
import { IntegrationType, SlackOutputConfig } from "terse-types"
import { TERSE_AGENT_MESSAGE_EVENT_TYPE, TerseAgentMessageMetadata } from "terse-types"

import { initializeSlackWebClient } from "../../../integrations/SlackClient"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { resolveSlackChannelIdForDestination, resolveSlackDmCounterpartUser } from "../../../utility/slack"
import { isValidEpochTimestamp } from "../../../utility/strings"
import { ToolACLValidationResult, ToolACLValidator, denyToolACL, findConfigsByIntegrationId } from "../../abstract/acl"

/**
 * Tool for sending messages to Slack channels or DMs.
 * Messages are sent as the bot or as the connected user depending on workspace token type.
 */
export const slackSendMessageTool = defineSessionTool({
    name: "slack_send_message",
    description: `Send message to a Slack channel or DM. Provide channelId (C…/G…/D…) or slackUserId (U…) to open or reuse a 1:1 DM. Supports plain text (mrkdwn) or Block Kit (JSON blocks). If both are set, channelId is used.`,
    execute: async ({ integrationId, channelId, slackUserId, message, thread_ts, blocks: blocksJson }, runContext) => {
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
            const organizationId = runContext.context.user.organizationId
            const userSlackIntegration = await db().user_slack_integrations.findUnique({
                where: { id: integrationId, organization_id: organizationId },
                include: {
                    slack_integration: true
                }
            })

            if (!userSlackIntegration?.slack_integration) {
                throw new Error(`Slack integration not found: ${integrationId}`)
            }

            const resolvedChannelId = await resolveSlackChannelIdForDestination(integrationId, channelId ?? null, slackUserId ?? null)
            if (!resolvedChannelId) {
                throw new Error(
                    slackUserId
                        ? `Could not open or resolve a DM for Slack user ${slackUserId}. Check scopes (im:write, chat:write) and that the member is in this workspace.`
                        : "Could not resolve a destination channel. Provide a valid channelId or slackUserId."
                )
            }

            const client = await initializeSlackWebClient(userSlackIntegration)

            // Get channel name from API
            let channelName = resolvedChannelId // fallback to id
            try {
                const channelInfo = await client.conversations.info({ channel: resolvedChannelId })
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
                logger.warn("Failed to fetch Slack channel info for channel name", { error, channelId: resolvedChannelId })
                // Keep channelName as resolvedChannelId fallback
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
                channel: resolvedChannelId,
                text: message,
                blocks: blocks,
                thread_ts: validThreadTs,
                unfurl_links: true,
                unfurl_media: true,
                metadata: {
                    event_type: TERSE_AGENT_MESSAGE_EVENT_TYPE,
                    event_payload: {
                        run_id: runContext.context.runId,
                        automation_id: runContext.context.agentId,
                        organization_id: organizationId
                    }
                } satisfies TerseAgentMessageMetadata
            })

            if (!result.ok) {
                throw new Error(`Failed to send message: ${result.error}`)
            }
            const messagePreview = message.length > 100 ? message.substring(0, 100) + "..." : message
            const messageType = blocks ? "Block Kit" : "text"

            let slackPermalink: string | undefined
            if (result.ts && result.channel) {
                try {
                    const permalinkResult = await client.chat.getPermalink({
                        channel: result.channel,
                        message_ts: result.ts
                    })
                    slackPermalink = permalinkResult.permalink
                } catch (permalinkError) {
                    logger.warn("[Slack Output] Failed to fetch Slack permalink for sent message", {
                        permalinkError,
                        channelId: resolvedChannelId,
                        messageTs: result.ts
                    })
                }
            }

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
                channelId: resolvedChannelId,
                slackUserId,
                messageTs: result.ts,
                threadTs: thread_ts,
                hasBlocks: !!blocks,
                blocksCount: blocks?.length
            })

            return {
                success: true,
                message_ts: result.ts,
                channel: channelName,
                thread_ts: validThreadTs || result.ts,
                summary: `${messageType} message sent to ${channelName}: "${messagePreview}"`,
                has_blocks: !!blocks,
                actions: [action]
            }
        } catch (error: any) {
            logger.error(`[Slack Output] Failed to send message`, {
                error,
                channelId,
                slackUserId
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

export const validateSlackSendMessage: ToolACLValidator<"slack_send_message", SlackOutputConfig> = ({ args, configs }) =>
    validateSlackChannelOrUser(args.integrationId, args.channelId, args.slackUserId, configs)

export const validateSlackChannelOrUser = async (
    integrationId: string,
    channelId: string | null | undefined,
    slackUserId: string | null | undefined,
    configs: SlackOutputConfig[]
): Promise<ToolACLValidationResult> => {
    const matching = findConfigsByIntegrationId(integrationId, configs)
    const allowedChannelIds = matching.map(c => c.channelId).filter((id): id is string => !!id)
    const allowedUserIds = Array.from(new Set(matching.flatMap(c => c.userIds ?? [])))
    const anyListensToDms = matching.some(c => c.listenToUserDms === true)

    if (channelId) {
        if (allowedChannelIds.includes(channelId)) return { ok: true }
        if (anyListensToDms && channelId.startsWith("D")) return { ok: true }
        // A DM channel ("D…") is also allowed when the DM is with a user in the configured userIds allowlist.
        // This keeps read/send symmetric: if the agent can DM a configured user via slackUserId, it can also
        // read or follow up on that DM via the resulting channelId without requiring listenToUserDms.
        if (channelId.startsWith("D") && allowedUserIds.length > 0) {
            const counterpartUserId = await resolveSlackDmCounterpartUser(integrationId, channelId)
            if (counterpartUserId && allowedUserIds.includes(counterpartUserId)) return { ok: true }
        }
        return denyToolACL(
            `Slack channelId "${channelId}" is not allowed for integration "${integrationId}". Configured channels: ${allowedChannelIds.join(", ") || "(none)"}; DM users: ${allowedUserIds.join(", ") || "(none)"}; DM scope: ${anyListensToDms ? "yes (any D… channel accepted)" : "no"}.`
        )
    }

    if (slackUserId) {
        if (anyListensToDms) return { ok: true }
        if (allowedUserIds.includes(slackUserId)) return { ok: true }
        return denyToolACL(
            `Slack slackUserId "${slackUserId}" is not in the configured users for integration "${integrationId}" (${allowedUserIds.join(", ") || "(none)"}) and DM scope is not enabled.`
        )
    }

    return denyToolACL("Slack call requires either channelId or slackUserId.")
}
