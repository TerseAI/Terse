import logger from "../../logger"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { Agent, UserNotificationDestination } from "../../types/prisma"
import { formatNotificationMessage, formatRunFailureNotificationMessage, resolveSlackChannelIdForDestination, sendSlackApprovalMessage, sendSlackMessage } from "../../utility/slack"
import { formatApprovalNotificationFor } from "../utils"

export async function sendSlackNotification(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlack] No Slack integration ID found. Skipping.`)
        return
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifySlack] No Slack channel ID configured. Skipping.`)
        return
    }

    const message = formatNotificationMessage(runAction, { agentName: agent.name })

    await sendSlackMessage(notificationDestination.slack_integration_id, targetChannelId, message)
}

export async function sendSlackApprovalRequest(notificationDestination: UserNotificationDestination, runId: string, runAction: RunHistoryAction, agent: Agent) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifyApprovalRequest] No Slack integration ID found. Skipping.`)
        return
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifyApprovalRequest] No Slack channel ID configured. Skipping.`)
        return
    }

    if (!runAction.step_id) {
        logger.debug(`[notifyApprovalRequest] No step_id found in runAction. Skipping.`)
        return
    }

    const notificationFor = formatApprovalNotificationFor(runAction.action)

    await sendSlackApprovalMessage(notificationDestination.slack_integration_id, targetChannelId, runId, runAction.step_id, notificationFor, agent.name, agent.id)
}

export async function sendSlackRunFailure(notificationDestination: UserNotificationDestination, agent: Agent, runId: string, errorMessage: string) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlackRunFailure] No Slack integration ID found. Skipping.`)
        return
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifySlackRunFailure] No Slack channel ID configured. Skipping.`)
        return
    }

    const message = formatRunFailureNotificationMessage({
        agentId: agent.id,
        agentName: agent.name,
        runId,
        errorMessage
    })

    await sendSlackMessage(notificationDestination.slack_integration_id, targetChannelId, message)
}
