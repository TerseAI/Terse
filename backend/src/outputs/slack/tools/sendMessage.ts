import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { WebClient, KnownBlock } from "@slack/web-api";
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

You can send messages in two ways:
1. **Plain text**: Simple text messages with mrkdwn formatting
2. **Block Kit**: Rich, interactive messages with buttons, structured layouts, and dynamic content

FORMATTING GUIDE (Plain Text):
- Use Slack's mrkdwn format for rich text
- *bold* for emphasis
- _italic_ for secondary emphasis
- \`code\` for inline code
- \`\`\`code block\`\`\` for multi-line code
- <url|text> for links
- Use bullet points (•) for lists
- Use emoji sparingly for visual appeal

BLOCK KIT GUIDE:
Block Kit allows you to create rich, interactive messages with:
- **Buttons**: Interactive buttons that can open URLs (e.g., dashboards) or trigger actions
- **Structured layouts**: Section blocks with fields for organized information
- **Visual elements**: Dividers, images, headers for better presentation

When to use Block Kit:
- When you need interactive buttons (e.g., "Open Dashboard" button)
- When presenting structured data (metrics, reports with fields)
- When you want better visual organization than plain text
- When you need to provide quick actions to users

When to use plain text:
- Simple notifications or updates
- Short messages that don't need structure
- When you don't need interactive elements

BEST PRACTICES:
- Keep messages concise and actionable
- Structure information with headers and sections
- Include relevant links when available
- Use threading for follow-up messages when appropriate
- For Block Kit: Always provide a fallback text message`,
    parameters: z.object({
        message: z.string().describe("The message content to send. Supports Slack mrkdwn formatting. This is used as fallback text when blocks are provided, or as the main message when blocks are not provided."),
        thread_ts: z.string().nullable().optional().describe("Optional thread timestamp to reply to an existing thread. If provided, the message will be posted as a reply in that thread."),
        blocks: z.string().nullable().optional().describe("Optional Block Kit JSON array as a string. Use this for rich, interactive messages with buttons, structured layouts, and dynamic content. Must be a valid JSON array of Block Kit blocks. Example: '[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"*Report*\"}},{\"type\":\"actions\",\"elements\":[{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\"Open Dashboard\"},\"url\":\"https://example.com/dashboard\",\"action_id\":\"open_dashboard\"}]}]'"),
    }),
    execute: async (args, runContext?: RunContext<SlackChannelSession>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }
        const session = runContext.context;
        
        if (!session.slackIntegration || !session.slackConfig) {
            throw new Error("Slack session is not properly configured");
        }

        const { message, thread_ts, blocks: blocksJson } = args;
        const channelId = session.slackConfig.channel_id;

        if (!channelId) {
            throw new Error("No channel configured for this Slack output");
        }

        // Parse and validate Block Kit blocks if provided
        let blocks: KnownBlock[] | undefined;
        if (blocksJson) {
            try {
                const parsed = JSON.parse(blocksJson);
                if (!Array.isArray(parsed)) {
                    throw new Error("Blocks must be a JSON array");
                }
                // Basic validation: ensure each block has a type
                for (const block of parsed) {
                    if (!block || typeof block !== 'object' || !block.type) {
                        throw new Error("Each block must be an object with a 'type' property");
                    }
                }
                blocks = parsed as KnownBlock[];
            } catch (error: any) {
                logger.error(`[Slack Output] Invalid Block Kit JSON`, { 
                    error: error.message,
                    blocksJson: blocksJson.substring(0, 200), // Log first 200 chars for debugging
                });
                throw new Error(`Invalid Block Kit JSON: ${error.message}. Blocks must be a valid JSON array of Block Kit blocks.`);
            }
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
                blocks: blocks,
                thread_ts: thread_ts || undefined,
                unfurl_links: true,
                unfurl_media: true,
            });

            if (!result.ok) {
                throw new Error(`Failed to send message: ${result.error}`);
            }

            const channelName = session.slackConfig.channel_name || channelId;
            const messagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;
            const messageType = blocks ? 'Block Kit' : 'text';
            
            logger.info(`[Slack Output] ${messageType} message sent to ${channelName}`, { 
                channelId,
                messageTs: result.ts,
                threadTs: thread_ts,
                hasBlocks: !!blocks,
                blocksCount: blocks?.length,
            });

            return {
                success: true,
                message_ts: result.ts,
                channel: channelName,
                thread_ts: thread_ts || result.ts,
                summary: `${messageType} message sent to ${channelName}: "${messagePreview}"`,
                has_blocks: !!blocks,
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
