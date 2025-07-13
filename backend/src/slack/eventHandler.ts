import chalk from 'chalk';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { db } from '../prismaClient';
import { AgentSession } from '../agent/agents/Agent';
import { getUserTicketManager } from '../types/user';
import { sendMessage } from './sendMessage';

// export function isValidSlackSig(req: Request) {
//     const ts = req.headers['x-slack-request-timestamp'];
//     const sig = req.headers['x-slack-signature'];
    
//     // Convert the raw buffer to string
//     const body = req.body.toString();
    
//     console.log('ts', ts);
//     console.log('sig', sig);
//     console.log('body', body); // This should show the raw JSON string
    
//     const hmac = crypto
//         .createHmac('sha256', process.env.SLACK_CLIENT_SECRET || '')
//         .update(`v0:${ts}:${body}`)
//         .digest('hex');

//     console.log('secret', process.env.SLACK_CLIENT_SECRET);
//     console.log('hmac', hmac);
//     console.log('sig === `v0=${hmac}`', sig === `v0=${hmac}`);
//     return sig === `v0=${hmac}`;
// }

export function isValidSlackSig(req: Request) {
    const ts = req.headers['x-slack-request-timestamp'] as string;
    const sig = req.headers['x-slack-signature'] as string;
    
    if (!ts || !sig) {
        console.log('Missing timestamp or signature headers');
        return false;
    }
    
    // Convert buffer to string for signature validation
    const body = Buffer.isBuffer(req.body) ? req.body.toString() : req.body;
    
    const hmac = crypto
        .createHmac('sha256', process.env.SLACK_CLIENT_SECRET || '')
        .update(`v0:${ts}:${body}`)
        .digest('hex');

    const isValid = sig === `v0=${hmac}`;
    console.log('Slack signature validation:', isValid);
    return isValid;
}

export async function handleSlackEvent(req: Request, res: Response) {
    console.log('handleSlackEvent route has been hit')
    if (!isValidSlackSig(req)) return res.sendStatus(400);

    // Parse the raw buffer as JSON
    let body: Record<string, unknown>;
    try {
        const bodyString = Buffer.isBuffer(req.body) ? req.body.toString() : req.body;
        body = JSON.parse(bodyString);
    } catch (error) {
        console.error('Failed to parse Slack event body:', error);
        return res.sendStatus(400);
    }

    console.log(chalk.green('Slack event received', JSON.stringify(body)));

    // URL verification challenge
    if (body.type === 'url_verification') {
        return res.send((body as { challenge: string }).challenge);
    }

    const team_id = body.team_id as string;
    const ev = body.event as Record<string, unknown>;

    switch (ev.type) {
        case 'app_uninstalled':
            await markWorkspaceUninstalled(team_id); // delete tokens, close queues
            break;
        case 'tokens_revoked':
            const tokensEvent = ev as { tokens?: { bot?: string[]; oauth?: string[] } };
            await tokensEvent.tokens?.bot?.forEach(deactivateToken);
            await tokensEvent.tokens?.oauth?.forEach(deactivateToken);
            break;
        case 'message':
            await handleSlackMessage(ev as unknown as SlackMessageEvent, team_id);
            break;
    }
    res.sendStatus(200);
}

async function markWorkspaceUninstalled(team_id: string) {
    console.log(chalk.red('Workspace uninstalled. Deleting records from database...'));
    await db().user_slack_integrations.deleteMany({
        where: {
            slack_team_id: team_id
        }
    });

    await db().slack_integrations.deleteMany({
        where: {
            team_id: team_id
        }
    });

    console.log(chalk.green('Workspace uninstalled. Records deleted from database.'));
}

async function deactivateToken(token: string) {
    console.log(chalk.red('Token deactivated'));
}

interface SlackMessageEvent {
    type: 'message';
    channel: string;
    user: string;
    text: string;
    ts: string;
    bot_id?: string;
    subtype?: string;
    thread_ts?: string;
}

interface SlackEvent {
    type: string;
    team_id: string;
    event: SlackMessageEvent | { type: string; [key: string]: unknown };
}

async function handleSlackMessage(event: SlackMessageEvent, teamId: string) {
    try {
        console.log(chalk.blue('Processing Slack message event'), JSON.stringify(event, null, 2));
        
        // Ignore bot messages and messages without text
        if (event.bot_id || !event.text || event.subtype) {
            return;
        }
        
        // Get the Slack integration first to check bot user ID
        const slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: teamId
            }
        });
        
        if (!slackIntegration) {
            console.log(chalk.yellow('Slack integration not found'));
            return;
        }
        
        // Check if the bot is mentioned in the message or if it's a DM
        const botMentionPattern = new RegExp(`<@${slackIntegration.bot_user_id}>`);
        const isDM = event.channel.startsWith('D');
        const isMentioned = botMentionPattern.test(event.text);
        
        if (!isDM && !isMentioned) {
            console.log(chalk.yellow('Bot not mentioned in channel message, ignoring'));
            return;
        }
        
        // Get the user who sent the message
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: {
                slack_team_id: teamId,
                authed_user_id: event.user
            },
            include: {
                user: true
            }
        });
        
        if (!userSlackIntegration) {
            console.log(chalk.yellow('User not found for Slack message'));
            await sendMessage(
                "I don't recognize you. Please make sure you've connected your account through the web app.",
                slackIntegration.access_token,
                event.channel
            );
            return;
        }
        
        // Set up session for the Agent
        const ticketManager = await getUserTicketManager(userSlackIntegration.user.id);
        if (!ticketManager) {
            console.log(chalk.yellow('No ticket manager found for user'));
            await sendMessage(
                '❌ Unable to access your ticket system. Please check your Linear/Jira integration in the web app.',
                slackIntegration.access_token,
                event.channel
            );
            return;
        }
        
        const teams = await ticketManager.getTeams();
        const session = {
            user: userSlackIntegration.user,
            isUserInitiated: true,
            ticketManager: ticketManager,
            teamId: teams[0]?.id,
            currentUser: await ticketManager.me() || undefined,
        };
        
        // Clean the message text (remove bot mention if present)
        let cleanText = event.text;
        if (isMentioned) {
            cleanText = event.text.replace(botMentionPattern, '').trim();
        }
        
        console.log(chalk.blue('Processing ticket command via Agent:', cleanText));
        
        // Create agent session and process the message
        const agentSession = new AgentSession(session);
        
        // Format the message for the agent with context
        const agentMessage = `
User sent a message via Slack: "${cleanText}"

${isDM ? 'This is a direct message to the bot.' : 'This is a channel message where the bot was mentioned.'}

The user wants to interact with tickets using natural language. They might want to:
- Check ticket status
- Update ticket status  
- Add comments to tickets
- Create new tickets
- Assign tickets
- Search for tickets
- Get help with available commands

Please analyze their request and take appropriate action with the available ticket management tools.

If you cannot understand the request or need more information, respond with a helpful message explaining what you can do.

Always provide clear feedback on what actions you took or what information you found.

Remember to format your response for Slack (use *bold* for emphasis, not **bold**).
        `.trim();
        
        await agentSession.push({ user_message: agentMessage, visible_actors: [], timezone: 'America/New_York' });
        const result = await agentSession.run();
        
        // Send the agent's response back to Slack
        if (result.finalOutput) {
            const response = result.finalOutput as string;
            await sendMessage(
                response,
                slackIntegration.access_token,
                event.channel
            );
        } else {
            await sendMessage(
                "I processed your request but didn't have anything specific to report back.",
                slackIntegration.access_token,
                event.channel
            );
        }
        
        console.log(chalk.green('Slack message processed successfully'));
        
    } catch (error) {
        console.error(chalk.red('Error handling Slack message:'), error);
        
        // Try to send an error message back to the user
        try {
            const slackIntegration = await db().slack_integrations.findFirst({
                where: { team_id: teamId }
            });
            
            if (slackIntegration) {
                await sendMessage(
                    '❌ Sorry, I encountered an error processing your request. Please try again or contact support.',
                    slackIntegration.access_token,
                    event.channel
                );
            }
        } catch (sendError) {
            console.error(chalk.red('Error sending error message to Slack:'), sendError);
        }
    }
}