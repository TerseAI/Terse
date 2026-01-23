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
import SlackChatInterface from "../agent/ChatAgent/SlackChatInterface";
import ChatAgent from "../agent/ChatAgent/ChatAgent";
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry";
import { isFormIntegrationInstallation, isOAuthIntegrationInstallation, FormFieldDefinition, ConfigurationFieldDefinition, FormSubmissionInput } from "../integrations/abstract/Integration";
import { IntegrationType } from "../shared/Integrations";
import jwt from "jsonwebtoken";
import { jwt as jwtConfig } from "../config/settings";
import { integrationFormTaskQueue } from "../integrations/IntegrationTaskQueues";
import { IntegrationFormCompletedTask } from "../integrations/IntegrationFormCompletedTask";
import { createFeedbackModal, createFormModal, createOAuthModal, formFieldsToSlackBlocks, configurationFieldsToSlackBlocks, removeEyesReaction, addEyesReaction, createProcessingModal, createSuccessModal, createErrorModal } from "./blockKitHelpers";
import { createOAuthStateToken, OAuthStatePayload } from "../utility/oauth";
import { AppMentionEvent, GenericMessageEvent, ModalView } from "@slack/types";
/**
 * Gets the Terse user ID from a Slack user ID and team ID
 */
async function getUserIdFromSlackUser(slackUserId: string, teamId: string): Promise<string | undefined> {
  const userSlackIntegration = await db().user_slack_integrations.findFirst({
    where: {
      authed_user_id: slackUserId,
      slack_team_id: teamId
    },
  });
  return userSlackIntegration?.user_id;
}

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
  slack.message(async ({ event, body, context, say, client }) => {

    try {
      const messageEvent = event as GenericMessageEvent;
      // Check if message is in a thread (thread_ts is the root parent's timestamp)
      const threadTs = messageEvent.thread_ts;
      const isInThread = !!threadTs;

      // If in a thread, not from a bot, and the thread started with an @mention of our bot,
      // route to ChatAgent for conversational follow-up
      if (isInThread && !messageEvent.bot_id && messageEvent.text && context.botUserId) {
        const threadStartedByMention = await isThreadStartedByAppMention(
          client,
          messageEvent.channel,
          threadTs,
          context.botUserId
        );

        if (threadStartedByMention && messageEvent.ts) {
          logger.info('Thread reply in app_mention thread, routing to ChatAgent:', {
            threadTs,
            channel: messageEvent.channel,
            text: messageEvent.text
          });

          addEyesReaction(client, messageEvent);

          try {
            // Get the user ID from the Slack user ID and team ID
            const userId = await getUserIdFromSlackUser(messageEvent.user, body.team_id);
            if (!userId) {
              logger.warn('Could not find user ID for Slack user', { slackUserId: messageEvent.user, teamId: body.team_id });
              await say({
                text: 'Unable to identify your user account. Please ensure you have connected your Slack account to Terse.',
                thread_ts: threadTs,
              });
              return;
            }
            const slackChatInterface = new SlackChatInterface(messageEvent.channel, client, userId, messageEvent.user, threadTs);
            const chatAgent = new ChatAgent(slackChatInterface, threadTs, userId);
            await chatAgent.run(messageEvent.text);
          } catch(error) {
            logger.error('Error processing Slack thread reply:', { error });
            await say({
              text: 'An error occurred while processing your request. Please try again later.',
              thread_ts: threadTs,
            });
          } finally {
            removeEyesReaction(client, messageEvent);
          }
        }
      }

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

  slack.event('app_mention', async ({ event, body, say, client }) => {
    logger.info('Starting app_mention based ChatAgent run', { channel: event.channel, timestamp: event.ts });
    addEyesReaction(client, event as AppMentionEvent);

    const message = event.text as string;
    const chatId = event.ts as string; // Use the timestamp of the mention as the Chat ID!!!

    try {
      // Get the user ID from the Slack user ID and team ID
      if (!event.user || !body.team_id) {
        logger.warn('Could not find user ID for Slack user', { slackUserId: event.user, teamId: body.team_id });
        await say({
          text: 'Unable to identify your user account. Please ensure you have connected your Slack account to Terse.',
          thread_ts: chatId,
        });
        return;
      }
      const userId = await getUserIdFromSlackUser(event.user, body.team_id);
      if (!userId) {
        logger.warn('Could not find user ID for Slack user', { slackUserId: event.user, teamId: body.team_id });
        await say({
          text: 'Unable to identify your user account. Please ensure you have connected your Slack account to Terse.',
          thread_ts: chatId,
        });
        return;
      }
      const slackChatInterface = new SlackChatInterface(event.channel, client, userId, event.user, chatId);
      const chatAgent = new ChatAgent(slackChatInterface, chatId, userId);

      const messageWithContext = await buildSlackChannelContextMessage(client, message, event.channel);

      await chatAgent.run(messageWithContext);
    } catch(error) {
      logger.error('Error processing Slack app_mention:', { error });
      await say({
        text: 'An error occurred while processing your request. Please try again later.',
        thread_ts: chatId,
      });
    } finally {
      removeEyesReaction(client, event as AppMentionEvent);
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

  // Handle request changes button clicks - open modal for feedback
  slack.action(/^approval_request_changes_(.+)__(.+)$/, async ({ ack, body, action, respond, client }) => {
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

      // Extract runId and stepId from action_id format: approval_request_changes_{runId}__{stepId}
      const match = actionId.match(/^approval_request_changes_(.+)__(.+)$/);
      if (!match) {
        logger.error(`[Slack Approval] Invalid action_id format: ${actionId}`);
        await respond({ text: "Error: Invalid approval request format", response_type: "ephemeral" });
        return;
      }

      const [, runId, stepId] = match;
      logger.info(`[Slack Approval] Opening request changes modal for runId: ${runId}, stepId: ${stepId}`);

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
        await respond({ text: "Error: You don't have permission to request changes", response_type: "ephemeral" });
        return;
      }

      // Open modal with feedback input
      const triggerId = (body as any).trigger_id;
      if (!triggerId) {
        logger.error('[Slack Approval] No trigger_id in body');
        await respond({ text: "Error: Unable to open modal", response_type: "ephemeral" });
        return;
      }

      await client.views.open({
        trigger_id: triggerId,
        view: {
          ...createFeedbackModal({
            title: 'Request Changes',
            submitText: 'Submit',
            cancelText: 'Cancel',
            privateMetadata: JSON.stringify({ runId, stepId }),
            blockId: 'feedback_block',
            actionId: 'feedback',
            placeholder: 'Enter your feedback...',
          }),
          callback_id: 'request_changes_modal_submit',
        },
      });
    } catch (error) {
      logger.error('[Slack Approval] Error opening request changes modal:', { error });
      await respond({ text: "Error opening request changes modal", response_type: "ephemeral" });
    }
  });

  // Handle reject button clicks - stops the flow immediately without modal
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
      logger.info(`[Slack Approval] Processing hard reject for runId: ${runId}, stepId: ${stepId}`);

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

      // Use centralized approval service with hardReject flag - it handles Slack notifications internally
      const result = await ApprovalService.processApproval({
        runId,
        stepId,
        approved: false,
        userId,
        hardReject: true,
      });

      if (result.status === 'failed' && result.error) {
        logger.error(`[Slack Approval] Hard reject processing failed: ${result.error}`);
      } else {
        logger.info(`[Slack Approval] Successfully processed hard reject for runId: ${runId}, stepId: ${stepId}`);
      }
    } catch (error) {
      logger.error('[Slack Approval] Error processing hard reject:', { error });
      await respond({ text: "Error processing rejection request", response_type: "ephemeral" });
    }
  });

  // Handle request changes modal submission
  slack.view('request_changes_modal_submit', async ({ ack, body, view, client }) => {
    // NOTE: Slack requires view submissions to be acknowledged within 3 seconds.
    // Keep all DB/network work strictly after `ack()`.

    // Extract feedback from the view (no awaits)
    const feedbackBlock = view.state.values.feedback_block;
    const feedback = feedbackBlock?.feedback?.value;

    if (!feedback || feedback.trim().length === 0) {
      await ack({
        response_action: 'errors',
        errors: {
          feedback_block: 'Feedback is required',
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
          feedback_block: 'Invalid request data',
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
        logger.info(`[Slack Approval] Processing request changes with feedback for runId: ${runId}, stepId: ${stepId}`);

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
          await notifySubmitter("Error: You don't have permission to request changes", approvalMessage.slack_channel_id);
          return;
        }

        // Process the request changes with the feedback
        const result = await ApprovalService.processApproval({
          runId,
          stepId,
          approved: false,
          userId,
          rejectionReason: feedback.trim(),
        });

        if (result.status === 'failed' && result.error) {
          logger.error(`[Slack Approval] Request changes processing failed: ${result.error}`);
          await notifySubmitter(`Error processing request changes: ${result.error}`, approvalMessage.slack_channel_id);
        } else {
          logger.info(`[Slack Approval] Successfully processed request changes with feedback for runId: ${runId}, stepId: ${stepId}`);
        }
      } catch (error) {
        logger.error('[Slack Approval] Error processing request changes modal submission:', { error });
        await notifySubmitter('Error processing request changes. Please try again.');
      }
    })();
  });

  // Handle "View Run History" button clicks - just acknowledge the event
  slack.action('view_run_history', async ({ ack }) => {
    await ack();
  });

  // Handle integration form button clicks - open modal
  slack.action(/^open_integration_form_(.+)$/, async ({ ack, body, action, respond, client }) => {
    await ack();

    try {
      if (!('action_id' in action) || !('value' in action)) {
        logger.error('[Slack Integration Form] Action does not have required properties');
        await respond({ text: "Error: Invalid action format", response_type: "ephemeral" });
        return;
      }

      const actionWithValue = action as { action_id: string; value: string };
      const stateToken = actionWithValue.value;
      const actionId = actionWithValue.action_id;
      const match = actionId.match(/^open_integration_form_(.+)$/);
      if (!match) {
        logger.error(`[Slack Integration Form] Invalid action_id format: ${actionId}`);
        await respond({ text: "Error: Invalid integration form request", response_type: "ephemeral" });
        return;
      }

      const [, integrationType] = match;

      // Decode state token
      let statePayload: OAuthStatePayload;
      try {
        statePayload = jwt.verify(stateToken, jwtConfig.secret) as OAuthStatePayload;
      } catch (error) {
        logger.error('[Slack Integration Form] Error decoding state token', { error });
        await respond({ text: "Error: Invalid request data", response_type: "ephemeral" });
        return;
      }

      // Extract message timestamp from action body to replace button message after form completion
      const messageTs = (body as any).message?.ts;
      if (messageTs) {
        statePayload.messageTs = messageTs;
      }

      const userId = statePayload.userId;
      if (!userId) {
        logger.error('[Slack Integration Form] No userId in state payload');
        await respond({ text: "Error: Invalid request data", response_type: "ephemeral" });
        return;
      }

      // Remove JWT claims (exp, iat, nbf) before re-signing to avoid conflicts
      const { exp, iat, nbf, userId: _, ...additionalFields } = statePayload;

      // Re-sign state token with messageTs included
      const updatedStateToken = createOAuthStateToken({
        userId,
        additionalFields,
        expiresIn: "7d",
      });

      // Get integration manager
      const integrationManager = INTEGRATION_REGISTRY.find(
        (int) => int.integrationType === integrationType
      );

      if (!integrationManager) {
        logger.error('[Slack Integration Form] Integration not found', { integrationType });
        await respond({ text: `Error: Integration ${integrationType} not found`, response_type: "ephemeral" });
        return;
      }

      if (!isFormIntegrationInstallation(integrationManager)) {
        logger.error('[Slack Integration Form] Integration does not support form installation', { integrationType });
        await respond({ text: `Error: Integration ${integrationType} does not support form installation`, response_type: "ephemeral" });
        return;
      }

      // Get form fields
      const formFields = integrationManager.getFormFields();
      if (formFields.length === 0) {
        logger.error('[Slack Integration Form] No form fields defined', { integrationType });
        await respond({ text: "Error: No form fields defined for this integration", response_type: "ephemeral" });
        return;
      }

      // Convert form fields to Slack blocks
      const blocks = formFieldsToSlackBlocks(formFields);

      // Get trigger_id
      const triggerId = (body as any).trigger_id;
      if (!triggerId) {
        logger.error('[Slack Integration Form] No trigger_id in body');
        await respond({ text: "Error: Unable to open form", response_type: "ephemeral" });
        return;
      }

      // Open modal
      await client.views.open({
        trigger_id: triggerId,
        view: {
          ...createFormModal({
            title: `Connect ${integrationType}`,
            submitText: 'Connect',
            cancelText: 'Cancel',
            privateMetadata: updatedStateToken, // Store state token for view submission (includes messageTs)
            blocks: blocks,
          }),
          callback_id: 'integration_form_submit',
        },
      });
    } catch (error) {
      logger.error('[Slack Integration Form] Error opening form modal:', { error });
      await respond({ text: "Error opening integration form. Please try again.", response_type: "ephemeral" });
    }
  });

  // Helper function to process form submission after ack
  async function processIntegrationFormSubmission(
    client: any,
    viewId: string | undefined,
    userId: string,
    integrationType: IntegrationType,
    formValues: Record<string, string>,
    stateToken: string,
    statePayload: OAuthStatePayload,
    integrationManager: any
  ) {
    const updateModal = async (newView: ModalView) => {
      if (!viewId) return;
      try {
        await client.views.update({
          view_id: viewId,
          view: newView,
        });
      } catch (error) {
        logger.error('[Slack Integration Form] Failed to update modal:', { error });
      }
    };

    try {
      // Get user from database
      const user = await db().users.findUnique({
        where: { id: userId },
      });

      if (!user) {
        logger.error('[Slack Integration Form] User not found', { userId });
        await updateModal(createErrorModal({
          integrationType: integrationType,
          errorMessage: 'User not found',
          privateMetadata: stateToken,
        }));
        return;
      }

      // Create clean form submission input
      const input: FormSubmissionInput = {
        userId: userId,
        formValues: formValues,
      };

      // Call processFormSubmission with clean input
      const result = await integrationManager.processFormSubmission(input);

      if (!result.success) {
        const errorMsg = result.error || 'Failed to process integration';
        logger.error('[Slack Integration Form] Form submission failed', { error: errorMsg, integrationType, userId });
        await updateModal(createErrorModal({
          integrationType: integrationType,
          errorMessage: errorMsg,
          privateMetadata: stateToken,
        }));
        return;
      }

      // Get integration ID by querying the database
      const instances = await integrationManager.getInstancesForUser(userId);
      if (instances.length === 0) {
        logger.error('[Slack Integration Form] No integration instances found after submission', { integrationType, userId });
        await updateModal(createErrorModal({
          integrationType: integrationType,
          errorMessage: 'Integration was not created',
          privateMetadata: stateToken,
        }));
        return;
      }

      // Use the first instance (for integrations like PostHog, there's typically one per user)
      const integrationId = instances[0].id;

      logger.info('[Slack Integration Form] Form submission successful', { integrationType, integrationId, userId });

      // Emit integration form completed task
      integrationFormTaskQueue.emit(new IntegrationFormCompletedTask(
        integrationType,
        integrationId,
        userId,
        statePayload,
        new Date()
      ));

      // Update modal with success message
      await updateModal(createSuccessModal({
        integrationType: integrationType,
        privateMetadata: stateToken,
      }));
    } catch (error) {
      logger.error('[Slack Integration Form] Error processing form submission:', { error, integrationType, userId });
      await updateModal(createErrorModal({
        integrationType: integrationType,
        errorMessage: 'Error processing integration form. Please try again.',
        privateMetadata: stateToken,
      }));
    }
  }

  // Handle integration form submission
  slack.view('integration_form_submit', async ({ ack, body, view, client }) => {
    // NOTE: Slack requires view submissions to be acknowledged within 3 seconds.
    // Keep all DB/network work strictly after `ack()`.

    // Extract form values (no awaits before ack)
    const formValues: Record<string, string> = {};
    const stateValues = view.state.values;

    // Extract values from each block
    for (const blockId in stateValues) {
      const block = stateValues[blockId];
      for (const actionId in block) {
        const action = block[actionId];
        if ('value' in action && typeof action.value === 'string') {
          formValues[actionId] = action.value;
        }
      }
    }

    // Extract state token from private metadata (synchronous JWT verify)
    const stateToken = view.private_metadata;
    let statePayload: OAuthStatePayload;
    try {
      statePayload = jwt.verify(stateToken, jwtConfig.secret) as OAuthStatePayload;
    } catch (error) {
      logger.error('[Slack Integration Form] Error decoding state token in submission', { error });
      await ack({
        response_action: 'errors',
        errors: {
          [Object.keys(stateValues)[0] || 'form']: 'Invalid request data',
        },
      });
      return;
    }

    const userId = statePayload.userId;
    const integrationType = statePayload.integrationType as IntegrationType;

    if (!userId || !integrationType) {
      logger.error('[Slack Integration Form] Missing userId or integrationType in state payload');
      await ack({
        response_action: 'errors',
        errors: {
          [Object.keys(stateValues)[0] || 'form']: 'Invalid request data',
        },
      });
      return;
    }

    // Get integration manager (synchronous)
    const integrationManager = INTEGRATION_REGISTRY.find(
      (int) => int.integrationType === integrationType
    );

    if (!integrationManager || !isFormIntegrationInstallation(integrationManager)) {
      logger.error('[Slack Integration Form] Integration not found or does not support forms', { integrationType });
      await ack({
        response_action: 'errors',
        errors: {
          [Object.keys(stateValues)[0] || 'form']: 'Integration not found',
        },
      });
      return;
    }

    // Validate required fields (synchronous)
    const formFields = integrationManager.getFormFields();
    const errors: Record<string, string> = {};
    for (const field of formFields) {
      if (field.required && !formValues[field.name]) {
        errors[`${field.name}_block`] = `${field.label} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: 'errors',
        errors: errors,
      });
      return;
    }

    // Ack with processing state modal
    await ack({
      response_action: 'update',
      view: createProcessingModal({
        integrationType: integrationType,
        privateMetadata: stateToken,
      }),
    });

    // Process form submission asynchronously (fire and forget)
    const viewId = (body as any)?.view?.id as string | undefined;
    processIntegrationFormSubmission(
      client,
      viewId,
      userId,
      integrationType,
      formValues,
      stateToken,
      statePayload,
      integrationManager
    ).catch(error => {
      logger.error('[Slack Integration Form] Unhandled error in form submission:', { error });
    });
  });

  // Handle integration configuration button clicks - open modal
  slack.action(/^open_integration_config_(.+)$/, async ({ ack, body, action, respond, client }) => {
    await ack();

    try {
      if (!('action_id' in action) || !('value' in action)) {
        logger.error('[Slack Integration Config] Action does not have required properties');
        await respond({ text: "Error: Invalid action format", response_type: "ephemeral" });
        return;
      }

      const actionWithValue = action as { action_id: string; value: string };
      const stateToken = actionWithValue.value;
      const actionId = actionWithValue.action_id;
      const match = actionId.match(/^open_integration_config_(.+)$/);
      if (!match) {
        logger.error(`[Slack Integration Config] Invalid action_id format: ${actionId}`);
        await respond({ text: "Error: Invalid integration config request", response_type: "ephemeral" });
        return;
      }

      const [, integrationType] = match;

      // Decode state token
      let statePayload: OAuthStatePayload;
      try {
        statePayload = jwt.verify(stateToken, jwtConfig.secret) as OAuthStatePayload;
      } catch (error) {
        logger.error('[Slack Integration Config] Error decoding state token', { error });
        await respond({ text: "Error: Invalid request data", response_type: "ephemeral" });
        return;
      }

      // Extract message timestamp from action body to replace button message after OAuth completion
      const messageTs = (body as any).message?.ts;
      if (messageTs) {
        statePayload.messageTs = messageTs;
      }

      const userId = statePayload.userId;
      if (!userId) {
        logger.error('[Slack Integration Config] No userId in state payload');
        await respond({ text: "Error: Invalid request data", response_type: "ephemeral" });
        return;
      }

      // Remove JWT claims (exp, iat, nbf) before re-signing to avoid conflicts
      const { exp, iat, nbf, userId: _, ...additionalFields } = statePayload;

      // Re-sign state token with messageTs included
      const updatedStateToken = createOAuthStateToken({
        userId,
        additionalFields,
        expiresIn: "7d",
      });

      // Get integration manager
      const integrationManager = INTEGRATION_REGISTRY.find(
        (int) => int.integrationType === integrationType
      );

      if (!integrationManager) {
        logger.error('[Slack Integration Config] Integration not found', { integrationType });
        await respond({ text: `Error: Integration ${integrationType} not found`, response_type: "ephemeral" });
        return;
      }

      if (!isOAuthIntegrationInstallation(integrationManager)) {
        logger.error('[Slack Integration Config] Integration does not support OAuth installation', { integrationType });
        await respond({ text: `Error: Integration ${integrationType} does not support OAuth installation`, response_type: "ephemeral" });
        return;
      }

      // Get configuration fields
      const configFields = integrationManager.getConfigurationFields();
      if (configFields.length === 0) {
        logger.error('[Slack Integration Config] No configuration fields defined', { integrationType });
        await respond({ text: "Error: No configuration fields defined for this integration", response_type: "ephemeral" });
        return;
      }

      // Convert configuration fields to Slack blocks
      const blocks = configurationFieldsToSlackBlocks(configFields);

      // Get trigger_id
      const triggerId = (body as any).trigger_id;
      if (!triggerId) {
        logger.error('[Slack Integration Config] No trigger_id in body');
        await respond({ text: "Error: Unable to open configuration", response_type: "ephemeral" });
        return;
      }

      // Open modal
      await client.views.open({
        trigger_id: triggerId,
        view: {
          ...createFormModal({
            title: `Configure ${integrationType}`,
            submitText: 'Continue',
            cancelText: 'Cancel',
            privateMetadata: updatedStateToken, // Store state token for view submission (includes messageTs)
            blocks: blocks,
          }),
          callback_id: 'integration_config_submit',
        },
      });
    } catch (error) {
      logger.error('[Slack Integration Config] Error opening configuration modal:', { error });
      await respond({ text: "Error opening integration configuration. Please try again.", response_type: "ephemeral" });
    }
  });

  /**
   * Handles OAuth installation after configuration form submission.
   * Validates configuration, generates OAuth URL, and updates the modal with OAuth button.
   */
  async function handleOAuthInstallationFromConfigForm(
    view: any,
    configValues: Record<string, string>
  ): Promise<{ success: boolean; ackResponse?: any; error?: string }> {
    // Extract state token from private metadata (synchronous JWT verify)
    const stateToken = view.private_metadata;
    let statePayload: OAuthStatePayload;
    try {
      statePayload = jwt.verify(stateToken, jwtConfig.secret) as OAuthStatePayload;
    } catch (error) {
      logger.error('[Slack Integration Config] Error decoding state token in submission', { error });
      return {
        success: false,
        ackResponse: {
          response_action: 'errors',
          errors: {
            [Object.keys(view.state.values)[0] || 'config']: 'Invalid request data',
          },
        },
      };
    }

    const userId = statePayload.userId;
    const integrationType = statePayload.integrationType as IntegrationType;

    if (!userId || !integrationType) {
      logger.error('[Slack Integration Config] Missing userId or integrationType in state payload');
      return {
        success: false,
        ackResponse: {
          response_action: 'errors',
          errors: {
            [Object.keys(view.state.values)[0] || 'config']: 'Invalid request data',
          },
        },
      };
    }

    // Get integration manager (synchronous)
    const integrationManager = INTEGRATION_REGISTRY.find(
      (int) => int.integrationType === integrationType
    );

    if (!integrationManager || !isOAuthIntegrationInstallation(integrationManager)) {
      logger.error('[Slack Integration Config] Integration not found or does not support OAuth', { integrationType });
      return {
        success: false,
        ackResponse: {
          response_action: 'errors',
          errors: {
            [Object.keys(view.state.values)[0] || 'config']: 'Integration not found',
          },
        },
      };
    }

    // Validate required fields (synchronous)
    const configFields = integrationManager.getConfigurationFields();
    const errors: Record<string, string> = {};
    for (const field of configFields) {
      if (field.required && !configValues[field.name]) {
        errors[`${field.name}_block`] = `${field.label} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        ackResponse: {
          response_action: 'errors',
          errors: errors,
        },
      };
    }

    // Convert configuration values to options format (synchronous)
    // For Slack, we need to convert isBotUser string to boolean
    let options: any = undefined;
    if (integrationType === IntegrationType.SLACK) {
      const isBotUser = configValues['isBotUser'] === 'true';
      options = { isBotUser };
    }

    // Generate OAuth URL synchronously (before ack)
    // Pass additional state payload (chatId, channel, integrationType) to enable resuming ChatAgent after OAuth
    const additionalStatePayload: Record<string, string> | undefined = statePayload.chatId && statePayload.channel ? {
      chatId: statePayload.chatId,
      channel: statePayload.channel,
      integrationType: integrationType,
      ...(statePayload.messageTs && { messageTs: statePayload.messageTs }), // Include messageTs from config button if available
    } : undefined;

    const installationDetails = await integrationManager.getInstallationUrl(userId, options, additionalStatePayload);
    const oauthUrl = installationDetails.oauthUrl;

    // Store config values and state token in private_metadata for back button
    const backButtonMetadata = {
      stateToken: stateToken,
      configValues: configValues,
      integrationType: integrationType,
    };
    const backButtonMetadataToken = jwt.sign(backButtonMetadata, jwtConfig.secret, { expiresIn: "7d" });

    // Update modal view with OAuth URL button and back button
    return {
      success: true,
      ackResponse: {
        response_action: 'update',
        view: createOAuthModal({
          integrationType,
          oauthUrl,
          backButtonMetadata: backButtonMetadataToken,
        }),
      },
    };
  }

  // Handle integration configuration submission
  slack.view('integration_config_submit', async ({ ack, body, view, client }) => {
    // NOTE: Slack requires view submissions to be acknowledged within 3 seconds.
    // Keep all DB/network work strictly after `ack()`.

    // Extract configuration values (no awaits before ack)
    const configValues: Record<string, string> = {};
    const stateValues = view.state.values;

    // Extract values from each block (radio button selections)
    for (const blockId in stateValues) {
      const block = stateValues[blockId];
      for (const actionId in block) {
        const action = block[actionId];
        // Radio buttons return selected_option
        if ('selected_option' in action && action.selected_option && 'value' in action.selected_option) {
          configValues[actionId] = action.selected_option.value as string;
        }
      }
    }

    const result = await handleOAuthInstallationFromConfigForm(view, configValues);

    if (!result.success) {
      await ack(result.ackResponse!);
      return;
    }

    await ack(result.ackResponse!);
  });

  // Handle back button from OAuth URL view - restore configuration form
  slack.action(/^back_to_config_(.+)$/, async ({ ack, body, action, client }) => {
    await ack();

    try {
      if (!('action_id' in action)) {
        logger.error('[Slack Integration Config] Back button action does not have required properties');
        return;
      }

      const actionId = action.action_id;
      const match = actionId.match(/^back_to_config_(.+)$/);
      if (!match) {
        logger.error(`[Slack Integration Config] Invalid back button action_id format: ${actionId}`);
        return;
      }

      const [, integrationType] = match;

      // Get view_id from body to update the modal
      const viewId = (body as any).view?.id;
      if (!viewId) {
        logger.error('[Slack Integration Config] No view_id in back button body');
        return;
      }

      // Get private_metadata from view
      const privateMetadata = (body as any).view?.private_metadata;
      if (!privateMetadata) {
        logger.error('[Slack Integration Config] No private_metadata in back button view');
        return;
      }

      // Decode back button metadata
      let backButtonMetadata: any;
      try {
        backButtonMetadata = jwt.verify(privateMetadata, jwtConfig.secret);
      } catch (error) {
        logger.error('[Slack Integration Config] Error decoding back button metadata', { error });
        return;
      }

      const stateToken = backButtonMetadata.stateToken;

      // Decode original state token
      let statePayload: OAuthStatePayload;
      try {
        statePayload = jwt.verify(stateToken, jwtConfig.secret) as OAuthStatePayload;
      } catch (error) {
        logger.error('[Slack Integration Config] Error decoding state token in back button', { error });
        return;
      }

      // Get integration manager
      const integrationManager = INTEGRATION_REGISTRY.find(
        (int) => int.integrationType === integrationType
      );

      if (!integrationManager || !isOAuthIntegrationInstallation(integrationManager)) {
        logger.error('[Slack Integration Config] Integration not found or does not support OAuth', { integrationType });
        return;
      }

      // Get configuration fields
      const configFields = integrationManager.getConfigurationFields();
      if (configFields.length === 0) {
        logger.error('[Slack Integration Config] No configuration fields defined', { integrationType });
        return;
      }

      // Convert configuration fields to Slack blocks
      const blocks = configurationFieldsToSlackBlocks(configFields);

      // Remove JWT claims from state payload before re-signing
      const userId = statePayload.userId;
      if (!userId) {
        logger.error('[Slack Integration Config] No userId in state payload');
        return;
      }
      const { exp, iat, nbf, userId: _, ...additionalFields } = statePayload;
      const updatedStateToken = createOAuthStateToken({
        userId,
        additionalFields,
        expiresIn: "7d",
      });

      // Update modal view back to configuration form
      await client.views.update({
        view_id: viewId,
        view: {
          type: 'modal',
          callback_id: 'integration_config_submit',
          title: {
            type: 'plain_text',
            text: `Configure ${integrationType}`,
          },
          submit: {
            type: 'plain_text',
            text: 'Continue',
          },
          close: {
            type: 'plain_text',
            text: 'Cancel',
          },
          private_metadata: updatedStateToken,
          blocks: blocks,
        },
      });
    } catch (error) {
      logger.error('[Slack Integration Config] Error handling back button:', { error });
    }
  });

  // Catch-all handler for any other action events to prevent timeout errors
  // This should be last so it doesn't interfere with specific handlers above
  slack.action(/^(?!approval_(approve|reject|request_changes)_|open_integration_form_|open_integration_config_|back_to_config_).*$/, async ({ ack }) => {
    await ack();
  });

  // Handle app_uninstalled event
  slack.event('app_uninstalled', async ({ body }) => {
    try {
      const teamId = body.team_id;
      if (!teamId) {
        logger.error('app_uninstalled event missing team_id', { body });
        return;
      }

      // Format as SlackMessageEvent to match existing webhook handler format
      const slackMessageEvent: SlackMessageEvent = {
        type: 'app_uninstalled',
        team_id: teamId,
      };

      // Process with SlackIntegrationManager
      const slackIntegrationManager = new SlackIntegrationManager();
      await slackIntegrationManager.processWebhookEvent(slackMessageEvent);
      logger.info('Successfully processed app_uninstalled event', { teamId });
    } catch (error) {
      logger.error('Error processing app_uninstalled event:', { error, body });
    }
  });

  // Handle tokens_revoked event
  slack.event('tokens_revoked', async ({ body }) => {
    try {
      const teamId = body.team_id;
      if (!teamId) {
        logger.error('tokens_revoked event missing team_id', { body });
        return;
      }

      // Extract tokens from the event body
      // Slack sends tokens_revoked with tokens.bot and tokens.oauth arrays
      const tokens = (body as any).tokens as { bot?: string[]; oauth?: string[] } | undefined;

      // Format as SlackMessageEvent to match existing webhook handler format
      const slackMessageEvent: SlackMessageEvent = {
        type: 'tokens_revoked',
        team_id: teamId,
        tokens: tokens,
      };

      // Process with SlackIntegrationManager
      const slackIntegrationManager = new SlackIntegrationManager();
      await slackIntegrationManager.processWebhookEvent(slackMessageEvent);
      logger.info('Successfully processed tokens_revoked event', { teamId, tokenCounts: { bot: tokens?.bot?.length || 0, oauth: tokens?.oauth?.length || 0 } });
    } catch (error) {
      logger.error('Error processing tokens_revoked event:', { error, body });
    }
  });
  
  // Initialize Bolt without binding a port (Express will handle that)
  await slack.init();

  logger.info("✅ Slack Bolt app initialized");

  return {
    slack,
    receiver,
  };
}

async function buildSlackChannelContextMessage(
  client: SlackApp['client'],
  message: string,
  channelId: string
): Promise<string> {
  let channelName: string | undefined;
  try {
    const channelInfo = await client.conversations.info({ channel: channelId });
    channelName = (channelInfo.channel as { name?: string } | undefined)?.name;
  } catch (error) {
    logger.warn("Failed to fetch Slack channel info for chat context", {
      error,
      channelId,
    });
  }

  const channelLabel = channelName ? `#${channelName}` : "this channel";
  return `Message from the ${channelLabel} channel in Slack:\n\n${message}\n\nChannel ID: ${channelId}`;
}

async function isThreadStartedByAppMention(
  client: { conversations: { replies: (args: { channel: string; ts: string; limit: number }) => Promise<{ messages?: Array<{ text?: string }> }> } },
  channel: string,
  threadTs: string,
  botUserId: string
): Promise<boolean> {
  try {
    // Fetch the root message of the thread
    const replies = await client.conversations.replies({
      channel,
      ts: threadTs,
      limit: 1, // We only need the root message
    });

    const rootMessage = replies.messages?.[0];
    if (!rootMessage?.text) {
      return false;
    }

    // Check if the root message mentions the bot (format: <@U1234567890>)
    return rootMessage.text.includes(`<@${botUserId}>`);
  } catch (error) {
    logger.error('Error checking if thread started by app mention:', { error, channel, threadTs });
    return false;
  }
}