import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { WebClient } from "@slack/web-api";
import { db } from "../../../prismaClient";
import { SlackChannelSession } from "../SlackOutput";
import logger from "../../../logger";

/**
 * Tool for sending messages to Slack channels or DMs.
 * Messages are sent as the Terse bot.
 */
export const slackSendMessageTool = tool({
    name: "slack_send_message",
    description: `Send a message to the configured Slack channel or DM. Use this tool to post updates, reports, or responses to Slack. The message will be sent as the Terse bot.

FORMATTING GUIDE:
- Use Slack's mrkdwn format for rich text
- *bold* for emphasis
- _italic_ for secondary emphasis
- \`code\` for inline code
- \`\`\`code block\`\`\` for multi-line code
- <url|text> for links
- Use bullet points (•) for lists
- Use emoji sparingly for visual appeal

BEST PRACTICES:
- Keep messages concise and actionable
- Structure information with headers and sections
- Include relevant links when available
- Use threading for follow-up messages when appropriate`,
    parameters: z.object({
        message: z.string().describe("The message content to send. Supports Slack mrkdwn formatting."),
        thread_ts: z.string().nullable().optional().describe("Optional thread timestamp to reply to an existing thread. If provided, the message will be posted as a reply in that thread."),
    }),
    execute: async (args, runContext?: RunContext<SlackChannelSession>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }
        const session = runContext.context;
        
        if (!session.slackIntegration || !session.slackConfig) {
            throw new Error("Slack session is not properly configured");
        }

        const { message, thread_ts } = args;
        const channelId = session.slackConfig.channel_id;

        if (!channelId) {
            throw new Error("No channel configured for this Slack output");
        }

        try {
            // Get the workspace token
            const slackIntegration = await db().slack_integrations.findFirst({
                where: {
                    team_id: session.slackIntegration.slack_team_id,
                },
            });

            if (!slackIntegration) {
                throw new Error(`Slack workspace integration not found for team ${session.slackIntegration.slack_team_id}`);
            }

            const client = new WebClient(slackIntegration.access_token);

            const result = await client.chat.postMessage({
                channel: channelId,
                text: message,
                thread_ts: thread_ts || undefined,
                unfurl_links: true,
                unfurl_media: true,
            });

            if (!result.ok) {
                throw new Error(`Failed to send message: ${result.error}`);
            }

            const channelName = session.slackConfig.channel_name || channelId;
            const messagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;
            
            logger.info(`[Slack Output] Message sent to ${channelName}`, { 
                channelId,
                messageTs: result.ts,
                threadTs: thread_ts,
            });

            return {
                success: true,
                message_ts: result.ts,
                channel: channelName,
                thread_ts: thread_ts || result.ts,
                summary: `Message sent to ${channelName}: "${messagePreview}"`,
            };
        } catch (error: any) {
            logger.error(`[Slack Output] Failed to send message`, { 
                error,
                channelId,
            });
            
            // Provide helpful error messages
            if (error.data?.error === 'channel_not_found') {
                throw new Error(`Channel not found. The bot may not have access to this channel.`);
            } else if (error.data?.error === 'not_in_channel') {
                throw new Error(`The Terse bot is not a member of this channel. Please invite the bot to the channel first.`);
            } else if (error.data?.error === 'is_archived') {
                throw new Error(`Cannot send messages to an archived channel.`);
            }
            
            throw new Error(`Failed to send Slack message: ${error.message || error}`);
        }
    },
});
