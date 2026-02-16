import { KnownBlock, LogLevel, WebClient } from "@slack/web-api"

import { settings } from "../config/settings"
import { initializeSlackWebClient } from "../integrations/SlackClient"
import logger from "../logger"
import { db } from "../prismaClient"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { SlackApprovalMessageStatus } from "../slack/ApprovalStatus"
import { createApprovalMessage, createNotificationMessage, createRunFailureNotificationMessage, createUpdatedApprovalMessage } from "../slack/blockKitHelpers"

export interface SlackMessage {
    text: string
    blocks?: KnownBlock[]
}

export interface NotificationContext {
    channelName: string
}

export interface RunFailureNotificationContext {
    agentId: string
    agentName: string
    runId: string
    errorMessage: string
}

export async function sendSlackMessage(userSlackIntegrationId: string, channelId: string, message: SlackMessage): Promise<boolean> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true,
            user: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[sendSlackMessage] No Slack integration found for ID: ${userSlackIntegrationId}`, { userSlackIntegrationId })
        return false
    }

    const client: WebClient = initializeSlackWebClient(userSlackIntegration)
    logger.debug(`[sendSlackMessage] Message`, { message, channelId, userSlackIntegrationId })

    try {
        await client.chat.postMessage({
            channel: channelId,
            text: message.text,
            blocks: message.blocks
        })

        logger.info(`[sendSlackMessage] Successfully sent message to channel ${channelId}`, { channelId, userSlackIntegrationId })
        return true
    } catch (error) {
        logger.error(`[sendSlackMessage] Failed to send message`, { error, channelId, userSlackIntegrationId })
        return false
    }
}

export async function resolveSlackChannelIdForDestination(userSlackIntegrationId: string, slackChannelId?: string | null, slackUserId?: string | null): Promise<string | null> {
    if (slackChannelId) {
        return slackChannelId
    }

    if (!slackUserId) {
        return null
    }

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true,
            user: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[resolveSlackChannelIdForDestination] No Slack integration found for ID: ${userSlackIntegrationId}`)
        return null
    }

    try {
        const client = initializeSlackWebClient(userSlackIntegration)
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

export async function getSlackClient(userSlackIntegrationId: string): Promise<WebClient | null> {
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

    return new WebClient(userSlackIntegration.slack_integration.access_token, {
        logLevel: LogLevel.ERROR
    })
}

export function formatNotificationMessage(runAction: RunHistoryAction, context: NotificationContext): SlackMessage {
    const actionEmoji =
        {
            create: "➕",
            update: "🔄",
            delete: "➖",
            read: "🔍",
            approval: "⏳"
        }[runAction.type] || "🔔"

    const text = `${context.channelName} - ${actionEmoji} ${runAction.action} - ${runAction.target}`

    const blocks = createNotificationMessage({
        action: runAction.action,
        target: runAction.target,
        emoji: actionEmoji,
        details: runAction.details,
        url: runAction.url
    })

    return { text, blocks }
}

export function formatRunFailureNotificationMessage(context: RunFailureNotificationContext): SlackMessage {
    const runHistoryLink = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.AGENTS.RUN_HISTORY(context.agentId, context.runId)}` : undefined
    const errorSummary = context.errorMessage.length > 300 ? `${context.errorMessage.slice(0, 297)}...` : context.errorMessage
    const text = `Run failed in ${context.agentName}: ${errorSummary}`

    const blocks = createRunFailureNotificationMessage({
        agentName: context.agentName,
        runId: context.runId,
        errorSummary,
        runHistoryLink
    })

    return { text, blocks }
}

export async function sendSlackApprovalMessage(
    userSlackIntegrationId: string,
    channelId: string,
    runId: string,
    stepId: string,
    summary: string,
    channelName: string,
    automationId?: string
): Promise<{ success: boolean; messageTs?: string }> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true,
            user: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[sendSlackApprovalMessage] No Slack integration found for ID: ${userSlackIntegrationId}`)
        return { success: false }
    }

    const client: WebClient = initializeSlackWebClient(userSlackIntegration)

    // Build deep link to run history if automationId is provided
    let runHistoryLink: string | undefined
    if (automationId) {
        const frontendUrl = settings.urls.frontend
        runHistoryLink = `${frontendUrl}${FrontendRoutes.AGENTS.RUN_HISTORY(automationId, runId)}`
    }

    const blocks = createApprovalMessage({
        channelName,
        summary,
        runId,
        stepId,
        runHistoryLink
    })

    const text = `Approval Request: ${summary} - ${channelName}`

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
                    summary: summary
                }
            })
            logger.info(`[sendSlackApprovalMessage] Successfully sent approval message to channel ${channelId} with ts ${result.ts}`)
            return { success: true, messageTs: result.ts }
        } else {
            logger.error(`[sendSlackApprovalMessage] Failed to send message: ${result.error}`)
            return { success: false }
        }
    } catch (error) {
        logger.error(`[sendSlackApprovalMessage] Failed to send message:`, { error })
        return { success: false }
    }
}

export async function updateSlackApprovalMessage(
    userSlackIntegrationId: string,
    channelId: string,
    messageTs: string,
    status: SlackApprovalMessageStatus,
    summary: string, // Human-readable summary instead of toolName
    channelName: string,
    automationId?: string,
    runId?: string,
    stepId?: string
): Promise<boolean> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId
        },
        include: {
            slack_integration: true,
            user: true
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[updateSlackApprovalMessage] No Slack integration found for ID: ${userSlackIntegrationId}`)
        return false
    }

    const client: WebClient = initializeSlackWebClient(userSlackIntegration)

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
        runHistoryLink = `${frontendUrl}${FrontendRoutes.AGENTS.RUN_HISTORY(automationId, runId)}`
    }

    const blocks = createUpdatedApprovalMessage({
        channelName,
        summary,
        status,
        statusEmoji,
        statusText,
        runHistoryLink,
        rejectionReason: rejectionReason || undefined
    })

    const text = `${statusText}: ${summary} - ${channelName}`

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
