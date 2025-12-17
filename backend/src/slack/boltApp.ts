import { App as SlackApp } from "@slack/bolt";
import ExpressReceiverModule from "@slack/bolt/dist/receivers/ExpressReceiver.js";
// ESM wraps CommonJS default exports, so we need to access .default
import type ExpressReceiverType from "@slack/bolt/dist/receivers/ExpressReceiver";
const ExpressReceiver = ((ExpressReceiverModule as any).default || ExpressReceiverModule) as typeof ExpressReceiverType;
import { settings } from "../config/settings";
import { db } from "../prismaClient";
import { SlackIntegrationManager, SlackMessageEvent } from "../integrations/SlackIntegration";
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

  // Handle approve button clicks - process directly
  slack.action(/^approval_approve_(.+)__(.+)$/, async ({ ack, body, action, respond, client }) => {
    await ack();

    try {
      // Type guard to ensure action has action_id property
      if (!('action_id' in action)) {
        logger.error('[Slack Approval] Action does not have action_id');
        await respond({ text: "Error: Invalid action format", response_type: "ephemeral" });
        return;
      }
      const actionWithId = action as { action_id: string };
      const actionId = actionWithId.action_id;

      // Extract runId and stepId from action_id format: approval_approve_{runId}__{stepId}
      const match = actionId.match(/^approval_approve_(.+)__(.+)$/);
      if (!match) {
        logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`);
        await respond({ text: "Error: Invalid approval request format", response_type: "ephemeral" });
        return;
      }

      const [, runId, stepId] = match;
      logger.info(`[Slack Approval] Processing approve for runId: ${runId}, stepId: ${stepId}`);

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

      // Use centralized approval service - it handles Slack notifications internally
      const result = await ApprovalService.processApproval({
        runId,
        stepId,
        approved: true,
        userId,
      });

      if (result.status === 'failed' && result.error) {
        logger.error(`[Slack Approval] Approval processing failed: ${result.error}`);
      } else {
        logger.info(`[Slack Approval] Successfully processed approve for runId: ${runId}, stepId: ${stepId}`);
      }
    } catch (error) {
      logger.error('[Slack Approval] Error processing approval:', { error });
      await respond({ text: "Error processing approval request", response_type: "ephemeral" });
    }
  });

  // Handle reject button clicks - open modal for rejection reason
  slack.action(/^approval_reject_(.+)__(.+)$/, async ({ ack, body, action, respond, client }) => {
    await ack();

    try {
      // Type guard to ensure action has action_id property
      if (!('action_id' in action)) {
        logger.error('[Slack Approval] Action does not have action_id');
        await respond({ text: "Error: Invalid action format", response_type: "ephemeral" });
        return;
      }
      const actionWithId = action as { action_id: string };
      const actionId = actionWithId.action_id;

      // Extract runId and stepId from action_id format: approval_reject_{runId}__{stepId}
      const match = actionId.match(/^approval_reject_(.+)__(.+)$/);
      if (!match) {
        logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`);
        await respond({ text: "Error: Invalid approval request format", response_type: "ephemeral" });
        return;
      }

      const [, runId, stepId] = match;
      logger.info(`[Slack Approval] Opening rejection modal for runId: ${runId}, stepId: ${stepId}`);

      // Verify the approval message exists
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

      // Get user from slack integration to verify access
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

      // Verify user has access to this run
      const runRecord = await db().run_history_records.findUnique({
        where: { id: runId },
        include: { automation: true },
      });

      if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
        logger.error(`[Slack Approval] User ${userId} does not have access to run ${runId}`);
        await respond({ text: "Error: You don't have permission to reject this request", response_type: "ephemeral" });
        return;
      }

      // Open modal with rejection reason input
      const triggerId = (body as any).trigger_id;
      if (!triggerId) {
        logger.error('[Slack Approval] No trigger_id in body');
        await respond({ text: "Error: Unable to open modal", response_type: "ephemeral" });
        return;
      }

      await client.views.open({
        trigger_id: triggerId,
        view: {
          type: 'modal',
          callback_id: 'rejection_modal_submit',
          title: {
            type: 'plain_text',
            text: 'Reject Approval Request',
          },
          submit: {
            type: 'plain_text',
            text: 'Submit',
          },
          close: {
            type: 'plain_text',
            text: 'Cancel',
          },
          private_metadata: JSON.stringify({ runId, stepId }),
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Please provide a reason for rejecting this approval request.',
              },
            },
            {
              type: 'input',
              block_id: 'rejection_reason_block',
              element: {
                type: 'plain_text_input',
                action_id: 'rejection_reason',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'Enter your rejection reason...',
                },
              },
              label: {
                type: 'plain_text',
                text: 'Rejection Reason',
              },
            },
          ],
        },
      });
    } catch (error) {
      logger.error('[Slack Approval] Error opening rejection modal:', { error });
      await respond({ text: "Error opening rejection modal", response_type: "ephemeral" });
    }
  });

  // Handle rejection modal submission
  slack.view('rejection_modal_submit', async ({ ack, body, view, client }) => {
    // NOTE: Slack requires view submissions to be acknowledged within 3 seconds.
    // Keep all DB/network work strictly after `ack()`.

    // Extract rejection reason from the view (no awaits)
    const rejectionReasonBlock = view.state.values.rejection_reason_block;
    const rejectionReason = rejectionReasonBlock?.rejection_reason?.value;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      await ack({
        response_action: 'errors',
        errors: {
          rejection_reason_block: 'Rejection reason is required',
        },
      });
      return;
    }

    // Extract runId and stepId from private metadata (no awaits)
    const privateMetadata = view.private_metadata;
    let metadata: { runId: string; stepId: string };
    try {
      metadata = JSON.parse(privateMetadata);
    } catch (error) {
      logger.error('[Slack Approval] Failed to parse private metadata:', { error, privateMetadata });
      await ack({
        response_action: 'errors',
        errors: {
          rejection_reason_block: 'Invalid request data',
        },
      });
      return;
    }

    // Ack immediately, then continue processing asynchronously
    await ack();

    void (async () => {
      const submitterSlackUserId = (body as any)?.user?.id as string | undefined;

      const notifySubmitter = async (text: string, channelId?: string) => {
        if (!submitterSlackUserId) return;

        // Prefer ephemeral in the original channel if we have it; fall back to DM.
        if (channelId) {
          try {
            await client.chat.postEphemeral({
              channel: channelId,
              user: submitterSlackUserId,
              text,
            });
            return;
          } catch (error) {
            logger.error('[Slack Approval] Failed to post ephemeral message to submitter:', { error });
          }
        }

        try {
          const opened = await client.conversations.open({ users: submitterSlackUserId });
          const dmChannelId = (opened as any)?.channel?.id as string | undefined;
          if (!dmChannelId) return;
          await client.chat.postMessage({ channel: dmChannelId, text });
        } catch (error) {
          logger.error('[Slack Approval] Failed to DM submitter:', { error });
        }
      };

      try {
        const { runId, stepId } = metadata;
        logger.info(`[Slack Approval] Processing rejection with reason for runId: ${runId}, stepId: ${stepId}`);

        // Find the approval message record
        const approvalMessage = await db().approval_slack_messages.findFirst({
          where: {
            run_id: runId,
            step_id: stepId,
          },
        });

        if (!approvalMessage) {
          logger.error(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`);
          await notifySubmitter('Error: Approval request not found');
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
          await notifySubmitter('Error: User integration not found', approvalMessage.slack_channel_id);
          return;
        }

        const userId = userSlackIntegration.user_id;

        // Verify user has access
        const runRecord = await db().run_history_records.findUnique({
          where: { id: runId },
          include: { automation: true },
        });

        if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
          logger.error(`[Slack Approval] User ${userId} does not have access to run ${runId}`);
          await notifySubmitter("Error: You don't have permission to reject this request", approvalMessage.slack_channel_id);
          return;
        }

        // Process the rejection with the reason
        const result = await ApprovalService.processApproval({
          runId,
          stepId,
          approved: false,
          userId,
          rejectionReason: rejectionReason.trim(),
        });

        if (result.status === 'failed' && result.error) {
          logger.error(`[Slack Approval] Rejection processing failed: ${result.error}`);
          await notifySubmitter(`Error processing rejection: ${result.error}`, approvalMessage.slack_channel_id);
        } else {
          logger.info(`[Slack Approval] Successfully processed rejection with reason for runId: ${runId}, stepId: ${stepId}`);
        }
      } catch (error) {
        logger.error('[Slack Approval] Error processing rejection modal submission:', { error });
        await notifySubmitter('Error processing rejection. Please try again.');
      }
    })();
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

