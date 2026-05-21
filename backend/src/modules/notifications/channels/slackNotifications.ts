import { RunHistoryAction } from "terse-types"

import logger from "../../../common/logger"
import { formatNotificationMessage, formatRunFailureNotificationMessage, resolveSlackChannelIdForDestination, sendSlackApprovalMessage, sendSlackMessage } from "../../../integrations/slack/helpers"
import { FailureState } from "../../../modules/agents/AgentRunner/runHistory"
import { Agent, UserNotificationDestination } from "../../../types/prisma"
import { formatApprovalNotificationFor } from "../utils"

export async function sendSlackNotification(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent): Promise<string | undefined> {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlack] No Slack integration ID found. Skipping.`)
        return undefined
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifySlack] No Slack channel ID configured. Skipping.`)
        return undefined
    }

    const message = formatNotificationMessage(runAction, { agentName: agent.name })

    const result = await sendSlackMessage(notificationDestination.slack_integration_id, targetChannelId, message)
    return result.permalink
}

export async function sendSlackApprovalRequest(notificationDestination: UserNotificationDestination, runId: string, runAction: RunHistoryAction, agent: Agent): Promise<string | undefined> {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifyApprovalRequest] No Slack integration ID found. Skipping.`)
        return undefined
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifyApprovalRequest] No Slack channel ID configured. Skipping.`)
        return undefined
    }

    if (!runAction.step_id) {
        logger.debug(`[notifyApprovalRequest] No step_id found in runAction. Skipping.`)
        return undefined
    }

    const notificationFor = formatApprovalNotificationFor(runAction.action)

    const result = await sendSlackApprovalMessage(notificationDestination.slack_integration_id, targetChannelId, runId, runAction.step_id, notificationFor, agent.name, agent.id)
    return result.permalink
}

export async function sendSlackRunFailure(
    notificationDestination: UserNotificationDestination,
    agent: Agent,
    runId: string,
    errorMessage: string,
    failureState: FailureState
): Promise<string | undefined> {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlackRunFailure] No Slack integration ID found. Skipping.`)
        return undefined
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifySlackRunFailure] No Slack channel ID configured. Skipping.`)
        return undefined
    }

    const message = formatRunFailureNotificationMessage({
        agentId: agent.id,
        agentName: agent.name,
        runId,
        errorMessage,
        failureState
    })

    const result = await sendSlackMessage(notificationDestination.slack_integration_id, targetChannelId, message)
    return result.permalink
}
