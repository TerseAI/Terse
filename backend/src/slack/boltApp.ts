import { App as SlackApp } from "@slack/bolt";
import ExpressReceiverModule from "@slack/bolt/dist/receivers/ExpressReceiver.js";
// ESM wraps CommonJS default exports, so we need to access .default
import type ExpressReceiverType from "@slack/bolt/dist/receivers/ExpressReceiver";
const ExpressReceiver = ((ExpressReceiverModule as any).default || ExpressReceiverModule) as typeof ExpressReceiverType;
import { settings } from "../config/settings";
import { db } from "../prismaClient";
import chalk from "chalk";
import { SlackIntegrationManager, SlackMessageEvent } from "../integrations/SlackIntegration";
import { updateSlackApprovalMessage } from "../utility/slack";
import { generateApprovalSummary } from "../utility/approvalSummary";
import { getInputConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { storeChatEvent, finalizeRunStatus, markRunFailed } from "../agent/ChannelAgent/runHistory";
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket";
import { ChannelAgent } from "../agent/ChannelAgent/ChannelAgent";

/**
 * Creates and configures the Slack Bolt app with ExpressReceiver
 * This isolates all Slack Bolt code from the main server.ts
 */
export async function setupSlackBolt() {
  // Validate required environment variables
  if (!settings.slack.signingSecret) {
    console.warn(chalk.yellow("⚠️  SLACK_SIGNING_SECRET not set - Slack Bolt app will not be initialized"));
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
      const messageEvent = event as any;
      const slackMessageEvent: SlackMessageEvent = {
        type: "event_callback",
        team_id: body.team_id || "",
        event_id: body.event_id,
        authorizations: body.authorizations?.map((auth: any) => ({
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
          channel_type: messageEvent.channel_type,
        },
      };
      
      // Process with existing webhook handler
      const slackIntegrationManager = new SlackIntegrationManager();
      await slackIntegrationManager.processWebhookEvent(slackMessageEvent);
    } catch (error) {
      console.error(chalk.red("Error processing Slack message:"), error);
    }
  });
  
  // Example slash command - these WILL work because commands aren't event_callback types
  slack.command("/hello", async ({ ack, respond }) => {
    await ack();
    await respond("Hello from Bolt inside Express!");
  });

  // Handle approval button clicks
  slack.action(/^approval_(approve|reject)_(.+)__(.+)$/, async ({ ack, body, action, respond }) => {
    await ack();
    
    try {
      const actionBody = body as any;
      const actionId = (action as any).action_id as string;
      
      // Extract runId and stepId from action_id format: approval_{approve|reject}_{runId}__{stepId}
      // Using double underscore (__) as separator since both runId and stepId can contain single underscores
      const match = actionId.match(/^approval_(approve|reject)_(.+)__(.+)$/);
      if (!match) {
        console.error(chalk.red(`[Slack Approval] Invalid action_id format: ${actionId}`));
        await respond({ text: "Error: Invalid approval request format", response_type: "ephemeral" });
        return;
      }

      const [, decision, runId, stepId] = match;
      const approved = decision === 'approve';

      console.log(chalk.blue(`[Slack Approval] Processing ${decision} for runId: ${runId}, stepId: ${stepId}`));

      // Find the approval message record
      const approvalMessage = await (db() as any).approval_slack_messages.findFirst({
        where: {
          run_id: runId,
          step_id: stepId,
        },
      });

      if (!approvalMessage) {
        console.error(chalk.red(`[Slack Approval] No approval message found for runId: ${runId}, stepId: ${stepId}`));
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
        console.error(chalk.red(`[Slack Approval] No user slack integration found`));
        await respond({ text: "Error: User integration not found", response_type: "ephemeral" });
        return;
      }

      const userId = userSlackIntegration.user_id;

      // Verify the run belongs to this user
      const runRecord = await db().run_history_records.findUnique({
        where: { id: runId },
        include: { automation: true },
      });

      if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
        console.error(chalk.red(`[Slack Approval] User ${userId} does not have access to run ${runId}`));
        await respond({ text: "Error: You don't have permission to approve this request", response_type: "ephemeral" });
        return;
      }

      // Get channel info for updating message
      const channel = await db().automations.findUnique({
        where: { id: runRecord.automation.id },
      });

      if (!channel) {
        console.error(chalk.red(`[Slack Approval] Channel not found`));
        await respond({ text: "Error: Channel not found", response_type: "ephemeral" });
        return;
      }

      // Get tool name and arguments for generating summary
      // Try to get it from the ToolApprovalRequest chat event first (most reliable)
      const prisma = db();
      const approvalEvent = await prisma.run_history_chat_events.findFirst({
        where: {
          run_history_record_id: runId,
          event_type: 'ToolApprovalRequest',
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      let toolName = "Tool";
      let toolArguments: string | object = {};
      
      if (approvalEvent && approvalEvent.event_json) {
        const eventData = approvalEvent.event_json as any;
        if (eventData.name && eventData.step_id === stepId) {
          toolName = eventData.name;
          toolArguments = eventData.arguments || {};
        }
      }

      // Fallback to run_history_actions if chat event not found
      if (toolName === "Tool") {
        const runAction = await prisma.run_history_actions.findFirst({
          where: {
            run_history_record_id: runId,
            step_id: stepId,
          },
        });
        toolName = runAction?.target || "Tool";
        // Try to extract arguments from details
        if (runAction?.details) {
          const detailsMatch = runAction.details.match(/with arguments: (.+)/);
          if (detailsMatch) {
            try {
              toolArguments = JSON.parse(detailsMatch[1]);
            } catch {
              toolArguments = detailsMatch[1];
            }
          }
        }
      }

      // Generate human-readable summary
      const summary = await generateApprovalSummary(
        runId,
        toolName,
        toolArguments,
        channel.id,
        userId
      );

      // Immediately update Slack message to show processing state
      await updateSlackApprovalMessage(
        approvalMessage.user_slack_integration_id,
        approvalMessage.slack_channel_id,
        approvalMessage.slack_message_ts,
        'processing',
        summary,
        channel.name,
        channel.id,
        runId
      );

      // Update database record to processing status
      await (db() as any).approval_slack_messages.update({
        where: {
          id: approvalMessage.id,
        },
        data: {
          status: 'processing',
        },
      });

      // Process approval directly (same logic as socket handler)
      const approvalRunRecord = await prisma.run_history_records.findUnique({
        where: { id: runId },
        include: { automation: true },
      });

      if (!approvalRunRecord || !approvalRunRecord.automation || approvalRunRecord.automation.user_id !== userId) {
        console.error(chalk.red(`[Slack Approval] User ${userId} does not have access to run ${runId}`));
        await respond({ text: "Error: You don't have permission to approve this request", response_type: "ephemeral" });
        return;
      }

      const channelWithRelations = await prisma.automations.findUnique({
        where: {
          id: approvalRunRecord.automation.id,
          user_id: userId,
        },
        include: {
          prompt: true,
          inputs: {
            include: getInputConfigInclude(),
          },
          output: {
            include: getOutputConfigInclude(),
          },
        },
      }) as any;

      if (!channelWithRelations) {
        console.error(chalk.red(`[Slack Approval] Channel not found`));
        await respond({ text: "Error: Channel not found", response_type: "ephemeral" });
        return;
      }

      const outputIntegration = channelWithRelations.output;
      if (!outputIntegration) {
        console.error(chalk.red(`[Slack Approval] No output integration found`));
        await respond({ text: "Error: Output integration not found", response_type: "ephemeral" });
        return;
      }

      const output = OutputFactory.createOutput(outputIntegration.config_type);
      if (!output) {
        console.error(chalk.red(`[Slack Approval] Output type not supported`));
        await respond({ text: "Error: Output type not supported", response_type: "ephemeral" });
        return;
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.error(chalk.red(`[Slack Approval] User not found`));
        await respond({ text: "Error: User not found", response_type: "ephemeral" });
        return;
      }

      let session: any;
      try {
        session = await output.createSessionFromConfig(
          outputIntegration.integration_id,
          outputIntegration,
          user
        );
      } catch (error) {
        console.error(chalk.red(`[Slack Approval] Failed to create session: ${error}`));
        await respond({ text: "Error: Failed to create session", response_type: "ephemeral" });
        return;
      }

      // Ensure run status is 'in_progress' for streaming
      if (approvalRunRecord.status !== 'in_progress') {
        await prisma.run_history_records.update({
          where: { id: runId },
          data: { status: 'in_progress' },
        });
      }

      const toolApprovalResponseEvent = {
        type: 'ToolApprovalResponse',
        step_id: stepId,
        approved: approved,
      };
      await storeChatEvent(runId, toolApprovalResponseEvent as any);
      emitCacheInvalidationWithWildcard(user.id, 'runHistory', channelWithRelations.id);
      emitCacheInvalidationWithWildcard(user.id, 'chatHistory', runId);

      const runContext = { runId };
      const channelAgent = new ChannelAgent(session, output, channelWithRelations, runContext);
      await channelAgent.initializeAgent();

      try {
        const decision: 'approve' | 'reject' = approved ? 'approve' : 'reject';
        const result = await channelAgent.resumeFromPendingApproval(
          decision,
          stepId,
          {
            runId,
            userId: userId,
            channelId: channelWithRelations.id,
          }
        );

        // Update Slack message to show final approval status
        const status = approved ? 'approved' : 'rejected';

        await updateSlackApprovalMessage(
          approvalMessage.user_slack_integration_id,
          approvalMessage.slack_channel_id,
          approvalMessage.slack_message_ts,
          status,
          summary, // Use the same summary we generated earlier
          channelWithRelations.name,
          channelWithRelations.id,
          runId
        );

        // Update database record to final status
        await (db() as any).approval_slack_messages.update({
          where: {
            id: approvalMessage.id,
          },
          data: {
            status: status,
          },
        });

        // Finalize run status based on result
        if (result.status === 'completed') {
          const hasFinalOutput = Boolean(result.result?.finalOutput);
          try {
            await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
            emitCacheInvalidationWithWildcard(userId, 'runHistory', channelWithRelations.id);
          } catch (e) {
            console.error(chalk.yellow('Failed to finalize run status'), e);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red.bold(`[Slack Approval] Error resuming agent: ${errorMessage}`), error);

        try {
          // Update Slack message to show error state
          await updateSlackApprovalMessage(
            approvalMessage.user_slack_integration_id,
            approvalMessage.slack_channel_id,
            approvalMessage.slack_message_ts,
            approved ? 'approved' : 'rejected', // Still show the decision, but processing failed
            summary, // Use the same summary we generated earlier
            channelWithRelations.name,
            channelWithRelations.id,
            runId
          );

          // Update database record - keep the decision status even if processing had errors
          await (db() as any).approval_slack_messages.update({
            where: {
              id: approvalMessage.id,
            },
            data: {
              status: approved ? 'approved' : 'rejected',
            },
          });

          await markRunFailed(runId, errorMessage, 'agent');
          emitCacheInvalidationWithWildcard(userId, 'runHistory', channelWithRelations.id);
        } catch (e) {
          console.error(chalk.yellow('Failed to mark run as failed'), e);
        }
      }

      console.log(chalk.green(`[Slack Approval] Successfully processed ${decision} for runId: ${runId}, stepId: ${stepId}`));
    } catch (error) {
      console.error(chalk.red(`[Slack Approval] Error processing approval:`, error));
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

  console.log(chalk.green("✅ Slack Bolt app initialized"));

  return {
    slack,
    receiver,
  };
}

