import { KnownBlock, LogLevel, WebClient } from "@slack/web-api"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"

import logger from "../../common/logger"
import { SlackApprovalMessageStatus } from "../../integrations/slack/ApprovalStatus"
import { createApprovalMessage, createNotificationMessage, createRunFailureNotificationMessage, createUpdatedApprovalMessage } from "../../integrations/slack/blockKitHelpers"
import { initializeSlackWebClient, resolveSlackAccessToken } from "../../integrations/slack/client"
import { db } from "../../loaders/prisma"
import { FailureState } from "../../modules/agents/AgentRunner/runHistory"
import { settings } from "../../settings"

export interface SlackMessage {
    text: string
    blocks?: KnownBlock[]
}

export interface NotificationContext {
    agentName: string
}

export interface RunFailureNotificationContext {
    agentId: string
    agentName: string
    runId: string
    errorMessage: string
    failureState: FailureState
}

export const SLACKBOT_USER_ID = "USLACKBOT"

export function describeSlackPostMessageError(error: unknown): string | null {
    const code = (error as { data?: { error?: string } } | null | undefined)?.data?.error
    switch (code) {
        case "channel_not_found":
            return "Channel not found. The Terse bot may not have access to this channel."
        case "not_in_channel":
            return "The Terse bot is not a member of this channel. Invite it with `/invite @terse` and try again."
        case "is_archived":
            return "This channel is archived, so messages can't be posted to it."
        case "msg_too_long":
            return "The message is too long for Slack (4000 character limit)."
        case "cannot_reply_to_message":
            return "This message type cannot have thread replies. Send without thread_ts instead."
        case "restricted_action_thread_locked":
            return "This thread has been locked by admins, so replies can't be posted to it."
        case "restricted_action_thread_only_channel":
            return "This channel only allows thread replies. Provide a thread_ts to reply to an existing thread."
        case "rate_limited":
        case "ratelimited":
            return "Slack rate-limited this request. Try again in a few seconds."
        default:
            return null
    }
}

export async function sendSlackMessage(userSlackIntegrationId: string, channelId: string, message: SlackMessage): Promise<{ success: boolean; permalink?: string; error?: string }> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[sendSlackMessage] No Slack integration found for ID: ${userSlackIntegrationId}`, { userSlackIntegrationId })
        return { success: false, error: "Slack integration not found." }
    }

    const client: WebClient = await initializeSlackWebClient(userSlackIntegration)
    logger.debug(`[sendSlackMessage] Message`, { message, channelId, userSlackIntegrationId })

    try {
        const result = await client.chat.postMessage({
            channel: channelId,
            text: message.text,
            blocks: message.blocks
        })

        logger.info(`[sendSlackMessage] Successfully sent message to channel ${channelId}`, { channelId, userSlackIntegrationId })

        let permalink: string | undefined
        if (result.ok && result.ts && result.channel) {
            try {
                const permalinkResult = await client.chat.getPermalink({
                    channel: result.channel,
                    message_ts: result.ts
                })
                permalink = permalinkResult.permalink
            } catch (permalinkError) {
                logger.warn(`[sendSlackMessage] Failed to get permalink`, { permalinkError, channelId })
            }
        }

        return { success: true, permalink }
    } catch (error) {
        logger.error(`[sendSlackMessage] Failed to send message`, { error, channelId, userSlackIntegrationId })
        return { success: false, error: describeSlackPostMessageError(error) ?? "Slack rejected the message." }
    }
}

/**
 * For a DM channel id (e.g. "D…"), return the other Slack user id that the DM is with.
 * Returns null when the channel is not a 1:1 DM, when the integration is missing, or when the API call fails.
 */
export async function resolveSlackDmCounterpartUser(userSlackIntegrationId: string, channelId: string): Promise<string | null> {
    if (!channelId || !channelId.startsWith("D")) return null

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: { id: userSlackIntegrationId },
        include: { slack_integration: true }
    })

    if (!userSlackIntegration?.slack_integration) {
        return null
    }

    try {
        const client = await initializeSlackWebClient(userSlackIntegration)
        const info = await client.conversations.info({ channel: channelId })
        const ch = info.channel as { is_im?: boolean; user?: string } | undefined
        if (ch?.is_im && ch?.user) return ch.user
        return null
    } catch (error) {
        logger.warn(`[resolveSlackDmCounterpartUser] Failed to resolve DM counterpart`, { error, userSlackIntegrationId, channelId })
        return null
    }
}

export async function resolveSlackChannelIdForDestination(userSlackIntegrationId: string, slackChannelId?: string | null, slackUserId?: string | null): Promise<string | null> {
    if (slackChannelId) {
        return slackChannelId
    }

    if (!slackUserId) {
        return null
    }

    if (slackUserId === SLACKBOT_USER_ID) {
        logger.warn(`[resolveSlackChannelIdForDestination] Refusing to open DM with Slackbot`, { userSlackIntegrationId })
        return null
    }

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[resolveSlackChannelIdForDestination] No Slack integration found for ID: ${userSlackIntegrationId}`)
        return null
    }

    try {
        const client = await initializeSlackWebClient(userSlackIntegration)
        const result = await client.conversations.open({
            users: slackUserId
        })

        const dmChannelId = result.channel?.id
        if (!dmChannelId) {
            logger.error(`[resolveSlackChannelIdForDestination] Failed to open DM for user ${slackUserId}`, {
                userSlackIntegrationId,
                slackUserId
            })
            return null
        }

        return dmChannelId
    } catch (error) {
        logger.error(`[resolveSlackChannelIdForDestination] Error opening DM`, {
            error,
            userSlackIntegrationId,
            slackUserId
        })
        return null
    }
}

async function getSlackClient(userSlackIntegrationId: string): Promise<WebClient | null> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[getSlackClient] No Slack integration found for ID: ${userSlackIntegrationId}`, { userSlackIntegrationId })
        return null
    }

    const token = await resolveSlackAccessToken(userSlackIntegration)
    if (!token) {
        logger.error(`[getSlackClient] No Slack token found for integration: ${userSlackIntegrationId}`, { userSlackIntegrationId })
        return null
    }

    return new WebClient(token, {
        logLevel: LogLevel.ERROR
    })
}

export function formatNotificationMessage(runAction: RunHistoryAction, context: NotificationContext): SlackMessage {
    const notificationFor = `${runAction.action || "New activity"}${runAction.target ? ` on ${runAction.target}` : ""}`
    const text = `Notification: ${context.agentName} - ${notificationFor}`

    const blocks = createNotificationMessage({
        agentName: context.agentName,
        notificationFor,
        details: runAction.details,
        url: runAction.url
    })

    return { text, blocks }
}

export function formatRunFailureNotificationMessage(context: RunFailureNotificationContext): SlackMessage {
    const runHistoryLink = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.JOBS.RUN_HISTORY, { id: context.agentId, runId: context.runId })}` : undefined
    const agentSettingsLink = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.JOBS.ALERTS, { id: context.agentId })}` : undefined
    const errorSummary = context.errorMessage.length > 300 ? `${context.errorMessage.slice(0, 297)}...` : context.errorMessage
    let text: string
    switch (context.failureState.tier) {
        case "paused":
            text = `Terse paused agent ${context.agentName} after ${context.failureState.consecutiveFailures} consecutive failures`
            break
        case "warning":
            text = `Run failed in ${context.agentName} (${context.failureState.consecutiveFailures} in a row — one more will pause it)`
            break
        default:
            text = `Run failed in ${context.agentName}: ${errorSummary}`
            break
    }

    const blocks = createRunFailureNotificationMessage({
        agentName: context.agentName,
        errorSummary,
        runHistoryLink,
        agentSettingsLink,
        failureState: context.failureState
    })

    return { text, blocks }
}

export async function sendSlackApprovalMessage(
    userSlackIntegrationId: string,
    channelId: string,
    runId: string,
    stepId: string,
    notificationFor: string,
    agentName: string,
    automationId?: string
): Promise<{ success: boolean; messageTs?: string; permalink?: string; error?: string }> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[sendSlackApprovalMessage] No Slack integration found for ID: ${userSlackIntegrationId}`)
        return { success: false, error: "Slack integration not found." }
    }

    const client: WebClient = await initializeSlackWebClient(userSlackIntegration)

    // Build deep link to run history if automationId is provided
    let runHistoryLink: string | undefined
    if (automationId) {
        const frontendUrl = settings.urls.frontend
        runHistoryLink = `${frontendUrl}${buildRoute(FrontendRoutes.JOBS.RUN_HISTORY, { id: automationId, runId })}`
    }

    const blocks = createApprovalMessage({
        agentName,
        notificationFor,
        runId,
        stepId,
        runHistoryLink
    })

    const text = `Approval Required: ${agentName} - ${notificationFor}`

    try {
        const result = await client.chat.postMessage({
            channel: channelId,
            text: text,
            blocks: blocks
        })

        if (result.ok && result.ts) {
            // Store message metadata in database
            await db().approval_slack_messages.create({
                data: {
                    run_id: runId,
                    step_id: stepId,
                    slack_channel_id: channelId,
                    slack_message_ts: result.ts,
                    user_slack_integration_id: userSlackIntegrationId,
                    status: "pending",
                    summary: notificationFor
                }
            })
            logger.info(`[sendSlackApprovalMessage] Successfully sent approval message to channel ${channelId} with ts ${result.ts}`)

            let permalink: string | undefined
            if (result.channel) {
                try {
                    const permalinkResult = await client.chat.getPermalink({
                        channel: result.channel,
                        message_ts: result.ts
                    })
                    permalink = permalinkResult.permalink
                } catch (permalinkError) {
                    logger.warn(`[sendSlackApprovalMessage] Failed to get permalink`, { permalinkError, channelId })
                }
            }

            return { success: true, messageTs: result.ts, permalink }
        } else {
            logger.error(`[sendSlackApprovalMessage] Failed to send message: ${result.error}`)
            return { success: false, error: result.error ?? "Slack rejected the message." }
        }
    } catch (error) {
        logger.error(`[sendSlackApprovalMessage] Failed to send message:`, { error })
        return { success: false, error: describeSlackPostMessageError(error) ?? "Slack rejected the message." }
    }
}

export async function updateSlackApprovalMessage(
    userSlackIntegrationId: string,
    channelId: string,
    messageTs: string,
    status: SlackApprovalMessageStatus,
    notificationFor: string,
    agentName: string,
    automationId?: string,
    runId?: string,
    stepId?: string
): Promise<boolean> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[updateSlackApprovalMessage] No Slack integration found for ID: ${userSlackIntegrationId}`)
        return false
    }

    const client: WebClient = await initializeSlackWebClient(userSlackIntegration)

    let statusEmoji: string
    let statusText: string

    if (status === SlackApprovalMessageStatus.PROCESSING) {
        statusEmoji = "⏳"
        statusText = "Processing"
    } else if (status === SlackApprovalMessageStatus.FAILED) {
        statusEmoji = "⚠️"
        statusText = "Failed"
    } else if (status === SlackApprovalMessageStatus.APPROVED) {
        statusEmoji = "✅"
        statusText = "Approved"
    } else if (status === SlackApprovalMessageStatus.CHANGES_REQUESTED) {
        statusEmoji = "🔄"
        statusText = "Changes Requested"
    } else {
        statusEmoji = "❌"
        statusText = "Rejected"
    }

    // Fetch rejection reason from database if status is rejected/changes_requested and runId/stepId are available
    let rejectionReason: string | null = null
    if ((status === SlackApprovalMessageStatus.REJECTED || status === SlackApprovalMessageStatus.CHANGES_REQUESTED) && runId && stepId) {
        const approvalMessage = await db().approval_slack_messages.findFirst({
            where: {
                run_id: runId,
                step_id: stepId
            }
        })
        if (approvalMessage?.rejection_reason) {
            rejectionReason = approvalMessage.rejection_reason
        }
    }

    // Build deep link to run history if automationId and runId are provided
    let runHistoryLink: string | undefined
    if (automationId && runId) {
        const frontendUrl = settings.urls.frontend
        runHistoryLink = `${frontendUrl}${buildRoute(FrontendRoutes.JOBS.RUN_HISTORY, { id: automationId, runId })}`
    }

    const blocks = createUpdatedApprovalMessage({
        agentName,
        notificationFor,
        status,
        statusEmoji,
        statusText,
        runHistoryLink,
        rejectionReason: rejectionReason || undefined
    })

    const text = `${statusText}: ${agentName} - ${notificationFor}`

    try {
        const result = await client.chat.update({
            channel: channelId,
            ts: messageTs,
            text: text,
            blocks: blocks
        })

        if (result.ok) {
            logger.info(`[updateSlackApprovalMessage] Successfully updated approval message in channel ${channelId} to status: ${status}`)
            return true
        } else {
            logger.error(`[updateSlackApprovalMessage] Failed to update message: ${result.error}`)
            return false
        }
    } catch (error) {
        logger.error(`[updateSlackApprovalMessage] Failed to update message:`, { error })
        return false
    }
}
