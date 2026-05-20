import { SlackAction, App as SlackApp, SlackViewAction } from "@slack/bolt"
// ESM wraps CommonJS default exports, so we need to access .default
import type ExpressReceiverType from "@slack/bolt/dist/receivers/ExpressReceiver"
import ExpressReceiverModule from "@slack/bolt/dist/receivers/ExpressReceiver.js"
import { GenericMessageEvent, ReactionAddedEvent } from "@slack/types"
import { IntegrationType } from "terse-types/Integrations"

import { settings } from "../config/settings"
import { SimplifiedSlackEvent, SlackIntegrationManager } from "../integrations/SlackIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { ApprovalProcessingStatus, ApprovalService } from "../services/ApprovalService"
import { SecretService } from "../services/SecretService"

import { createFeedbackModal } from "./blockKitHelpers"

const ExpressReceiver = ((ExpressReceiverModule as any).default || ExpressReceiverModule) as typeof ExpressReceiverType

type SlackClickerCheck = { ok: true; userId: string; organizationId: string } | { ok: false; reason: string }

async function resolveSlackClicker(body: SlackAction | SlackViewAction, expectedOrganizationId: string): Promise<SlackClickerCheck> {
    const slackUserId = body.user.id
    const slackTeamId = body.team?.id
    if (!slackUserId || !slackTeamId) {
        return { ok: false, reason: "clicker identity missing from action body" }
    }
    const clicker = await db().user_slack_integrations.findFirst({
        where: {
            authed_user_id: slackUserId,
            slack_team_id: slackTeamId,
            is_bot_user: false,
            organization_id: expectedOrganizationId
        },
        select: { user_id: true, organization_id: true }
    })
    if (!clicker) {
        return { ok: false, reason: `clicker ${slackUserId}@${slackTeamId} is not a member of org ${expectedOrganizationId}` }
    }
    return { ok: true, userId: clicker.user_id, organizationId: clicker.organization_id }
}

/**
 * Creates and configures the Slack Bolt app with ExpressReceiver
 * This isolates all Slack Bolt code from the main server.ts
 */
export async function setupSlackBolt() {
    if (!settings.slack.signingSecret) {
        logger.warn("⚠️  SLACK_SIGNING_SECRET not set - Slack Bolt app will not be initialized")
        return null
    }

    const receiver = new ExpressReceiver({
        signingSecret: settings.slack.signingSecret,
        // IMPORTANT: keep this relative if you plan to mount under /slack
        endpoints: "/events"
    })

    // Create Slack app with dynamic token resolution
    // Bolt will call authorize() to get the bot token for each workspace
    const slack = new SlackApp({
        receiver,
        deferInitialization: true,
        authorize: async ({ teamId, enterpriseId }) => {
            if (!teamId) {
                throw new Error("teamId is required for Slack authorization")
            }

            // Fetch the Slack integration for this workspace
            const slackIntegration = await db().slack_integrations.findUnique({
                where: {
                    team_id: teamId
                }
            })

            if (!slackIntegration) {
                throw new Error(`No Slack integration found for team_id: ${teamId}`)
            }
            const secretService = SecretService.getInstance()
            const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: slackIntegration.id } })
            const botToken = secrets.accessToken
            if (!botToken) {
                throw new Error(`No Slack bot token found for team_id: ${teamId}`)
            }

            return {
                botToken,
                botId: slackIntegration.bot_user_id,
                botUserId: slackIntegration.bot_user_id,
                teamId: slackIntegration.team_id,
                enterpriseId: enterpriseId || slackIntegration.enterprise_id || undefined
            }
        }
    })

    // Process message events using our existing webhook handler
    slack.message(async ({ event, body, context, say, client }) => {
        try {
            const messageEvent = event as GenericMessageEvent
            const slackMessageEvent: SimplifiedSlackEvent = {
                type: "event_callback",
                team_id: body.team_id || "",
                event_id: body.event_id,
                authorizations: body.authorizations?.map(auth => ({
                    enterprise_id: auth.enterprise_id || null,
                    team_id: auth.team_id || "",
                    user_id: auth.user_id || "",
                    is_bot: auth.is_bot || false,
                    is_enterprise_install: auth.is_enterprise_install || false
                })),
                event: {
                    type: "message",
                    channel: messageEvent.channel,
                    user: messageEvent.user,
                    text: messageEvent.text || "",
                    ts: messageEvent.ts,
                    thread_ts: messageEvent.thread_ts,
                    bot_id: messageEvent.bot_id,
                    subtype: messageEvent.subtype,
                    channel_type: messageEvent.channel_type as any // SlackChannelType - type guard needed for proper typing
                }
            }
            // Process with existing webhook handler
            const slackIntegrationManager = new SlackIntegrationManager()
            await slackIntegrationManager.processWebhookEvent(slackMessageEvent)
        } catch (error) {
            logger.error("Error processing Slack message:", { error })
        }
    })

    slack.event("app_mention", async ({ event, body, say, client }) => {
        const slackIntegrationManager = new SlackIntegrationManager()
        await slackIntegrationManager.processWebhookEvent({
            type: "event_callback",
            team_id: body.team_id || "",
            event_id: body.event_id,
            authorizations: body.authorizations?.map(auth => ({
                enterprise_id: auth.enterprise_id || null,
                team_id: auth.team_id || "",
                user_id: auth.user_id || "",
                is_bot: auth.is_bot || false,
                is_enterprise_install: auth.is_enterprise_install || false
            })),
            event: {
                type: "app_mention",
                channel: event.channel,
                user: event.user,
                text: event.text || "",
                ts: event.ts,
                thread_ts: event.thread_ts
            }
        })
    })

    slack.event("reaction_added", async ({ event, body }) => {
        try {
            const reactionEvent = event as ReactionAddedEvent
            const slackIntegrationManager = new SlackIntegrationManager()
            await slackIntegrationManager.processWebhookEvent({
                type: "event_callback",
                team_id: body.team_id || "",
                event_id: body.event_id,
                authorizations: body.authorizations?.map(auth => ({
                    enterprise_id: auth.enterprise_id || null,
                    team_id: auth.team_id || "",
                    user_id: auth.user_id || "",
                    is_bot: auth.is_bot || false,
                    is_enterprise_install: auth.is_enterprise_install || false
                })),
                event: {
                    type: "reaction_added",
                    user: reactionEvent.user,
                    reaction: reactionEvent.reaction,
                    item_user: reactionEvent.item_user,
                    event_ts: reactionEvent.event_ts,
                    item: {
                        type: reactionEvent.item.type,
                        channel: "channel" in reactionEvent.item ? reactionEvent.item.channel : undefined,
                        ts: "ts" in reactionEvent.item ? reactionEvent.item.ts : undefined
                    }
                }
            })
        } catch (error) {
            logger.error("Error processing Slack reaction_added:", { error })
        }
    })

    // Handle approve button clicks - process directly
    slack.action(/^approval_approve_(.+)__(.+)$/, async ({ ack, body, action, respond, client }) => {
        await ack()

        try {
            // Type guard to ensure action has action_id property
            if (!("action_id" in action)) {
                logger.error("[Slack Approval] Action does not have action_id")
                await respond({
                    text: "Error: Invalid action format",
                    response_type: "ephemeral"
                })
                return
            }
            const actionWithId = action as { action_id: string }
            const actionId = actionWithId.action_id

            // Extract runId and stepId from action_id format: approval_approve_{runId}__{stepId}
            const match = actionId.match(/^approval_approve_(.+)__(.+)$/)
            if (!match) {
                logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`)
                await respond({
                    text: "Error: Invalid approval request format",
                    response_type: "ephemeral"
                })
                return
            }

            const [, runId, stepId] = match
            logger.info(`[Slack Approval] Processing approve for runId: ${runId}, stepId: ${stepId}`)

            // Find the approval message record
            const approvalMessage = await db().approval_slack_messages.findFirst({
                where: {
                    run_id: runId,
                    step_id: stepId
                }
            })

            if (!approvalMessage) {
                logger.error(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`)
                await respond({
                    text: "Error: Approval request not found",
                    response_type: "ephemeral"
                })
                return
            }

            const runRecord = await db().run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true }
            })

            if (!runRecord || !runRecord.automation) {
                logger.error(`[Slack Approval] Run not found for runId: ${runId}`)
                await respond({
                    text: "Error: You don't have permission to approve this request",
                    response_type: "ephemeral"
                })
                return
            }

            const clicker = await resolveSlackClicker(body, runRecord.automation.organization_id)
            if (!clicker.ok) {
                logger.warn("[Slack Approval] Clicker authorization failed", { reason: clicker.reason, runId, stepId })
                await respond({
                    text: "Error: You don't have permission to approve this request",
                    response_type: "ephemeral"
                })
                return
            }

            const userId = clicker.userId
            const organizationId = clicker.organizationId

            // Use centralized approval service - it handles Slack notifications internally
            const result = await ApprovalService.processApproval({
                runId,
                stepId,
                approved: true,
                userId,
                organizationId
            })

            if (result.status === ApprovalProcessingStatus.FAILED && result.error) {
                logger.error(`[Slack Approval] Approval processing failed: ${result.error}`)
            } else {
                logger.info(`[Slack Approval] Successfully processed approve for runId: ${runId}, stepId: ${stepId}`)
            }
        } catch (error) {
            logger.error("[Slack Approval] Error processing approval:", { error })
            await respond({
                text: "Error processing approval request",
                response_type: "ephemeral"
            })
        }
    })

    // Handle request changes button clicks - open modal for feedback
    slack.action(/^approval_request_changes_(.+)__(.+)$/, async ({ ack, body, action, respond, client }) => {
        await ack()

        try {
            // Type guard to ensure action has action_id property
            if (!("action_id" in action)) {
                logger.error("[Slack Approval] Action does not have action_id")
                await respond({
                    text: "Error: Invalid action format",
                    response_type: "ephemeral"
                })
                return
            }
            const actionWithId = action as { action_id: string }
            const actionId = actionWithId.action_id

            // Extract runId and stepId from action_id format: approval_request_changes_{runId}__{stepId}
            const match = actionId.match(/^approval_request_changes_(.+)__(.+)$/)
            if (!match) {
                logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`)
                await respond({
                    text: "Error: Invalid approval request format",
                    response_type: "ephemeral"
                })
                return
            }

            const [, runId, stepId] = match
            logger.info(`[Slack Approval] Opening request changes modal for runId: ${runId}, stepId: ${stepId}`)

            // Verify the approval message exists
            const approvalMessage = await db().approval_slack_messages.findFirst({
                where: {
                    run_id: runId,
                    step_id: stepId
                }
            })

            if (!approvalMessage) {
                logger.error(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`)
                await respond({
                    text: "Error: Approval request not found",
                    response_type: "ephemeral"
                })
                return
            }

            const runRecord = await db().run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true }
            })

            if (!runRecord || !runRecord.automation) {
                logger.error(`[Slack Approval] Run not found for runId: ${runId}`)
                await respond({
                    text: "Error: You don't have permission to request changes",
                    response_type: "ephemeral"
                })
                return
            }

            const clicker = await resolveSlackClicker(body, runRecord.automation.organization_id)
            if (!clicker.ok) {
                logger.warn("[Slack Approval] Clicker authorization failed", { reason: clicker.reason, runId, stepId })
                await respond({
                    text: "Error: You don't have permission to request changes",
                    response_type: "ephemeral"
                })
                return
            }

            // Open modal with feedback input
            const triggerId = (body as any).trigger_id
            if (!triggerId) {
                logger.error("[Slack Approval] No trigger_id in body")
                await respond({
                    text: "Error: Unable to open modal",
                    response_type: "ephemeral"
                })
                return
            }

            await client.views.open({
                trigger_id: triggerId,
                view: {
                    ...createFeedbackModal({
                        title: "Request Changes",
                        submitText: "Submit",
                        cancelText: "Cancel",
                        privateMetadata: JSON.stringify({ runId, stepId }),
                        blockId: "feedback_block",
                        actionId: "feedback",
                        placeholder: "Enter your feedback..."
                    }),
                    callback_id: "request_changes_modal_submit"
                }
            })
        } catch (error) {
            logger.error("[Slack Approval] Error opening request changes modal:", {
                error
            })
            await respond({
                text: "Error opening request changes modal",
                response_type: "ephemeral"
            })
        }
    })

    // Handle reject button clicks - stops the flow immediately without modal
    slack.action(/^approval_reject_(.+)__(.+)$/, async ({ ack, body, action, respond, client }) => {
        await ack()

        try {
            // Type guard to ensure action has action_id property
            if (!("action_id" in action)) {
                logger.error("[Slack Approval] Action does not have action_id")
                await respond({
                    text: "Error: Invalid action format",
                    response_type: "ephemeral"
                })
                return
            }
            const actionWithId = action as { action_id: string }
            const actionId = actionWithId.action_id

            // Extract runId and stepId from action_id format: approval_reject_{runId}__{stepId}
            const match = actionId.match(/^approval_reject_(.+)__(.+)$/)
            if (!match) {
                logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`)
                await respond({
                    text: "Error: Invalid approval request format",
                    response_type: "ephemeral"
                })
                return
            }

            const [, runId, stepId] = match
            logger.info(`[Slack Approval] Processing hard reject for runId: ${runId}, stepId: ${stepId}`)

            // Find the approval message record
            const approvalMessage = await db().approval_slack_messages.findFirst({
                where: {
                    run_id: runId,
                    step_id: stepId
                }
            })

            if (!approvalMessage) {
                logger.error(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`)
                await respond({
                    text: "Error: Approval request not found",
                    response_type: "ephemeral"
                })
                return
            }

            const runRecord = await db().run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true }
            })

            if (!runRecord || !runRecord.automation) {
                logger.error(`[Slack Approval] Run not found for runId: ${runId}`)
                await respond({
                    text: "Error: You don't have permission to reject this request",
                    response_type: "ephemeral"
                })
                return
            }

            const clicker = await resolveSlackClicker(body, runRecord.automation.organization_id)
            if (!clicker.ok) {
                logger.warn("[Slack Approval] Clicker authorization failed", { reason: clicker.reason, runId, stepId })
                await respond({
                    text: "Error: You don't have permission to reject this request",
                    response_type: "ephemeral"
                })
                return
            }

            const userId = clicker.userId
            const organizationId = clicker.organizationId

            // Use centralized approval service with hardReject flag - it handles Slack notifications internally
            const result = await ApprovalService.processApproval({
                runId,
                stepId,
                approved: false,
                userId,
                organizationId,
                hardReject: true
            })

            if (result.status === ApprovalProcessingStatus.FAILED && result.error) {
                logger.error(`[Slack Approval] Hard reject processing failed: ${result.error}`)
            } else {
                logger.info(`[Slack Approval] Successfully processed hard reject for runId: ${runId}, stepId: ${stepId}`)
            }
        } catch (error) {
            logger.error("[Slack Approval] Error processing hard reject:", {
                error
            })
            await respond({
                text: "Error processing rejection request",
                response_type: "ephemeral"
            })
        }
    })

    // Handle request changes modal submission
    slack.view("request_changes_modal_submit", async ({ ack, body, view, client }) => {
        // NOTE: Slack requires view submissions to be acknowledged within 3 seconds.
        // Keep all DB/network work strictly after `ack()`.

        // Extract feedback from the view (no awaits)
        const feedbackBlock = view.state.values.feedback_block
        const feedback = feedbackBlock?.feedback?.value

        if (!feedback || feedback.trim().length === 0) {
            await ack({
                response_action: "errors",
                errors: {
                    feedback_block: "Feedback is required"
                }
            })
            return
        }

        // Extract runId and stepId from private metadata (no awaits)
        const privateMetadata = view.private_metadata
        let metadata: { runId: string; stepId: string }
        try {
            metadata = JSON.parse(privateMetadata)
        } catch (error) {
            logger.error("[Slack Approval] Failed to parse private metadata:", {
                error,
                privateMetadata
            })
            await ack({
                response_action: "errors",
                errors: {
                    feedback_block: "Invalid request data"
                }
            })
            return
        }

        // Ack immediately, then continue processing asynchronously
        await ack()

        void (async () => {
            const submitterSlackUserId = (body as any)?.user?.id as string | undefined

            const notifySubmitter = async (text: string, channelId?: string) => {
                if (!submitterSlackUserId) return

                // Prefer ephemeral in the original channel if we have it; fall back to DM.
                if (channelId) {
                    try {
                        await client.chat.postEphemeral({
                            channel: channelId,
                            user: submitterSlackUserId,
                            text
                        })
                        return
                    } catch (error) {
                        logger.error("[Slack Approval] Failed to post ephemeral message to submitter:", { error })
                    }
                }

                try {
                    const opened = await client.conversations.open({
                        users: submitterSlackUserId
                    })
                    const dmChannelId = (opened as any)?.channel?.id as string | undefined
                    if (!dmChannelId) return
                    await client.chat.postMessage({ channel: dmChannelId, text })
                } catch (error) {
                    logger.error("[Slack Approval] Failed to DM submitter:", { error })
                }
            }

            try {
                const { runId, stepId } = metadata
                logger.info(`[Slack Approval] Processing request changes with feedback for runId: ${runId}, stepId: ${stepId}`)

                // Find the approval message record
                const approvalMessage = await db().approval_slack_messages.findFirst({
                    where: {
                        run_id: runId,
                        step_id: stepId
                    }
                })

                if (!approvalMessage) {
                    logger.error(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`)
                    await notifySubmitter("Error: Approval request not found")
                    return
                }

                const runRecord = await db().run_history_records.findUnique({
                    where: { id: runId },
                    include: { automation: true }
                })

                if (!runRecord || !runRecord.automation) {
                    logger.error(`[Slack Approval] Run not found for runId: ${runId}`)
                    await notifySubmitter("Error: You don't have permission to request changes", approvalMessage.slack_channel_id)
                    return
                }

                const clicker = await resolveSlackClicker(body, runRecord.automation.organization_id)
                if (!clicker.ok) {
                    logger.warn("[Slack Approval] Clicker authorization failed", { reason: clicker.reason, runId, stepId })
                    await notifySubmitter("Error: You don't have permission to request changes", approvalMessage.slack_channel_id)
                    return
                }

                const userId = clicker.userId
                const organizationId = clicker.organizationId

                // Process the request changes with the feedback
                const result = await ApprovalService.processApproval({
                    runId,
                    stepId,
                    approved: false,
                    userId,
                    organizationId,
                    rejectionReason: feedback.trim()
                })

                if (result.status === ApprovalProcessingStatus.FAILED && result.error) {
                    logger.error(`[Slack Approval] Request changes processing failed: ${result.error}`)
                    await notifySubmitter(`Error processing request changes: ${result.error}`, approvalMessage.slack_channel_id)
                } else {
                    logger.info(`[Slack Approval] Successfully processed request changes with feedback for runId: ${runId}, stepId: ${stepId}`)
                }
            } catch (error) {
                logger.error("[Slack Approval] Error processing request changes modal submission:", { error })
                await notifySubmitter("Error processing request changes. Please try again.")
            }
        })()
    })

    // Handle "View Run History" button clicks - just acknowledge the event
    slack.action("view_run_history", async ({ ack }) => {
        await ack()
    })

    // Catch-all handler for any other action events to prevent timeout errors.
    // Slack requires every action to be acked within 3s; this absorbs the
    // ones that don't have a dedicated handler above. The negative lookahead
    // only needs to exclude prefixes that DO have dedicated handlers
    // (currently just approval_*) — anything else falls through here.
    slack.action(/^(?!approval_(approve|reject|request_changes)_).*$/, async ({ ack }) => {
        await ack()
    })

    // Handle app_uninstalled event
    slack.event("app_uninstalled", async ({ body }) => {
        try {
            const teamId = body.team_id
            if (!teamId) {
                logger.error("app_uninstalled event missing team_id", { body })
                return
            }

            // Format as SlackMessageEvent to match existing webhook handler format
            const slackMessageEvent: SimplifiedSlackEvent = {
                type: "app_uninstalled",
                team_id: teamId
            }

            // Process with SlackIntegrationManager
            const slackIntegrationManager = new SlackIntegrationManager()
            await slackIntegrationManager.processWebhookEvent(slackMessageEvent)
            logger.info("Successfully processed app_uninstalled event", { teamId })
        } catch (error) {
            logger.error("Error processing app_uninstalled event:", { error, body })
        }
    })

    // Handle tokens_revoked event
    slack.event("tokens_revoked", async ({ body }) => {
        try {
            const teamId = body.team_id
            if (!teamId) {
                logger.error("tokens_revoked event missing team_id", { body })
                return
            }

            // Extract tokens from the event body
            // Slack sends tokens_revoked with tokens.bot and tokens.oauth arrays
            const tokens = (body as any).tokens as { bot?: string[]; oauth?: string[] } | undefined

            // Format as SlackMessageEvent to match existing webhook handler format
            const slackMessageEvent: SimplifiedSlackEvent = {
                type: "tokens_revoked",
                team_id: teamId,
                tokens: tokens
            }

            // Process with SlackIntegrationManager
            const slackIntegrationManager = new SlackIntegrationManager()
            await slackIntegrationManager.processWebhookEvent(slackMessageEvent)
            logger.info("Successfully processed tokens_revoked event", {
                teamId,
                tokenCounts: {
                    bot: tokens?.bot?.length || 0,
                    oauth: tokens?.oauth?.length || 0
                }
            })
        } catch (error) {
            logger.error("Error processing tokens_revoked event:", { error, body })
        }
    })

    // Initialize Bolt without binding a port (Express will handle that)
    await slack.init()

    logger.info("✅ Slack Bolt app initialized")

    return {
        slack,
        receiver
    }
}
