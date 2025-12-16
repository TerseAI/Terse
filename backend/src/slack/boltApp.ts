import { App as SlackApp } from "@slack/bolt";
import ExpressReceiverModule from "@slack/bolt/dist/receivers/ExpressReceiver.js";
// ESM wraps CommonJS default exports, so we need to access .default
import type ExpressReceiverType from "@slack/bolt/dist/receivers/ExpressReceiver";
const ExpressReceiver = ((ExpressReceiverModule as any).default || ExpressReceiverModule) as typeof ExpressReceiverType;
import { ModelEvent } from "../shared/ModelEvents";
import { settings } from "../config/settings";
import { db } from "../prismaClient";
import { SlackIntegrationManager, SlackMessageEvent } from "../integrations/SlackIntegration";
import { updateSlackApprovalMessage } from "../utility/slack";
import { generateApprovalSummary } from "../agent/ApprovalSummaryAgent/ApprovalSummaryAgent";
import { ApprovalService } from "../services/ApprovalService";
import logger from "../logger";

/**
 * Creates and configures the Slack Bolt app with ExpressReceiver
 * This isolates all Slack Bolt code from the main server.ts
 */
export async function setupSlackBolt() {
  if (!settings.slack.signingSecret) {
    logger.warn("⚠️  SLACK_SIGNING_SECRET not set - Slack Bolt app will not be initialized");
    return null;
  }

  const receiver = new ExpressReceiver({
    signingSecret: settings.slack.signingSecret,
    // IMPORTANT: keep this relative if you plan to mount under /slack
    endpoints: "/events",
  });

  // Create Slack app with dynamic token resolution
  // Bolt will call authorize() to get the bot token for each workspace
  const slack = new SlackApp({
    receiver,
    deferInitialization: true,
    authorize: async ({ teamId, enterpriseId }) => {
      if (!teamId) {
        throw new Error("teamId is required for Slack authorization");
      }

      // Fetch the Slack integration for this workspace
      const slackIntegration = await db().slack_integrations.findUnique({
        where: {
          team_id: teamId,
        },
      });

      if (!slackIntegration) {
        throw new Error(`No Slack integration found for team_id: ${teamId}`);
      }

      return {
        botToken: slackIntegration.access_token,
        botId: slackIntegration.bot_user_id,
        botUserId: slackIntegration.bot_user_id,
        teamId: slackIntegration.team_id,
        enterpriseId: enterpriseId || slackIntegration.enterprise_id || undefined,
      };
    },
  });

  // Process message events using our existing webhook handler
  slack.message(async ({ event, body }) => {
    try {
      // Convert Bolt event to our SlackMessageEvent format
      // Bolt's message event type is not exported, so we type it based on the structure
      const messageEvent = event as { channel: string; user?: string; text?: string; ts?: string; thread_ts?: string; bot_id?: string; subtype?: string; channel_type?: string };
      const slackMessageEvent: SlackMessageEvent = {
        type: "event_callback",
        team_id: body.team_id || "",
        event_id: body.event_id,
        authorizations: body.authorizations?.map((auth) => ({
          enterprise_id: auth.enterprise_id || null,
          team_id: auth.team_id || "",
          user_id: auth.user_id || "",
          is_bot: auth.is_bot || false,
          is_enterprise_install: auth.is_enterprise_install || false,
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
          channel_type: messageEvent.channel_type as any, // SlackChannelType - type guard needed for proper typing
        },
      };
      
      // Process with existing webhook handler
      const slackIntegrationManager = new SlackIntegrationManager();
      await slackIntegrationManager.processWebhookEvent(slackMessageEvent);
    } catch (error) {
      logger.error('Error processing Slack message:', { error });
    }
  });

  // Handle approval button clicks
  slack.action(/^approval_(approve|reject)_(.+)__(.+)$/, async ({ ack, body, action, respond }) => {
    await ack();
    
    try {
      // Type guard to ensure action has action_id property
      // Bolt actions can be various types, but we need one with action_id
      if (!('action_id' in action)) {
        logger.error('[Slack Approval] Action does not have action_id');
        await respond({ text: "Error: Invalid action format", response_type: "ephemeral" });
        return;
      }
      const actionWithId = action as { action_id: string };
      const actionId = actionWithId.action_id;
      
      // Extract runId and stepId from action_id format: approval_{approve|reject}_{runId}__{stepId}
      // Using double underscore (__) as separator since both runId and stepId can contain single underscores
      const match = actionId.match(/^approval_(approve|reject)_(.+)__(.+)$/);
      if (!match) {
        logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`);
        await respond({ text: "Error: Invalid approval request format", response_type: "ephemeral" });
        return;
      }

      const [, decision, runId, stepId] = match;
      const approved = decision === 'approve';
      logger.info(`[Slack Approval] Processing ${decision} for runId: ${runId}, stepId: ${stepId}`);
      // Find the approval message record
      const approvalMessage = await db().approval_slack_messages.findFirst({
        where: {
          run_id: runId,
          step_id: stepId,
        },
      });

      if (!approvalMessage) {
        logger.error(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`);
        await respond({ text: "Error: Approval request not found", response_type: "ephemeral" });
        return;
      }

      // Get user from slack integration
      const userSlackIntegration = await db().user_slack_integrations.findUnique({
        where: {
          id: approvalMessage.user_slack_integration_id,
        },
        include: {
          user: true,
        },
      });

      if (!userSlackIntegration) {
        logger.error('[Slack Approval] No user slack integration found');
        await respond({ text: "Error: User integration not found", response_type: "ephemeral" });
        return;
      }

      const userId = userSlackIntegration.user_id;

      // Get channel info for updating message and generating summary
      const runRecord = await db().run_history_records.findUnique({
        where: { id: runId },
        include: { automation: true },
      });

      if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
        logger.error(`[Slack Approval] User ${userId} does not have access to run ${runId}`);
        await respond({ text: "Error: You don't have permission to approve this request", response_type: "ephemeral" });
        return;
      }

      const channel = await db().automations.findUnique({
        where: { id: runRecord.automation.id },
      });

      if (!channel) {
        logger.error('[Slack Approval] Channel not found');
        await respond({ text: "Error: Channel not found", response_type: "ephemeral" });
        return;
      }

      const prisma = db();

      const runActions = await prisma.run_history_actions.findMany({
        where: {
          run_history_record_id: runId,
          step_id: stepId,
        },
      });

      // Generate human-readable summary (Slack-specific UI logic)
      const {approvalSummary} = await generateApprovalSummary(
        runId,
        userId,
        channel.id,
        stepId
      );

      // Immediately update Slack message to show processing state (Slack-specific UI logic)
      await updateSlackApprovalMessage(
        approvalMessage.user_slack_integration_id,
        approvalMessage.slack_channel_id,
        approvalMessage.slack_message_ts,
        'processing',
        approvalSummary,
        channel.name,
        channel.id,
        runId
      );

      // Update database record to processing status (Slack-specific UI logic)
      await db().approval_slack_messages.update({
        where: {
          id: approvalMessage.id,
        },
        data: {
          status: 'processing',
        },
      });

      // Use centralized approval service for core business logic
      const result = await ApprovalService.processApproval({
        runId,
        stepId,
        approved,
        userId,
      });

      // Update Slack message based on result (Slack-specific UI logic)
      const status = approved ? 'approved' : 'rejected';
      await updateSlackApprovalMessage(
        approvalMessage.user_slack_integration_id,
        approvalMessage.slack_channel_id,
        approvalMessage.slack_message_ts,
        status,
        approvalSummary,
        channel.name,
        channel.id,
        runId
      );

      // Update database record to final status (Slack-specific UI logic)
      await db().approval_slack_messages.update({
        where: {
          id: approvalMessage.id,
        },
        data: {
          status: status,
        },
      });

      if (result.status === 'failed' && result.error) {
        logger.error(`[Slack Approval] Approval processing failed: ${result.error}`);
      } else {
        const decision = approved ? 'approve' : 'reject';
        logger.info(`[Slack Approval] Successfully processed ${decision} for runId: ${runId}, stepId: ${stepId}`);
      }
    } catch (error) {
      logger.error('[Slack Approval] Error processing approval:', { error });
      await respond({ text: "Error processing approval request", response_type: "ephemeral" });
    }
  });

  // Handle "View Run History" button clicks - just acknowledge the event
  slack.action('view_run_history', async ({ ack }) => {
    await ack();
  });

  // Catch-all handler for any other action events to prevent timeout errors
  // This should be last so it doesn't interfere with specific handlers above
  slack.action(/^(?!approval_(approve|reject)_).*$/, async ({ ack }) => {
    await ack();
  });

  // Initialize Bolt without binding a port (Express will handle that)
  await slack.init();

  logger.info("✅ Slack Bolt app initialized");

  return {
    slack,
    receiver,
  };
}

