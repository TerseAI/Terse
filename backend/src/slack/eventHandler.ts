import chalk from 'chalk';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { db } from '../prismaClient';
import { SlackEvent, SlackEventData } from '../Updater/InputEvents';
import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';

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
    
    console.log('=== Slack Signature Debug ===');
    console.log('Timestamp:', ts);
    console.log('Signature:', sig);
    console.log('Body type:', Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body);
    console.log('Has SLACK_SIGNING_SECRET:', !!process.env.SLACK_SIGNING_SECRET);
    console.log('Has SLACK_CLIENT_SECRET:', !!process.env.SLACK_CLIENT_SECRET);
    
    if (!ts || !sig) {
        console.log('Missing timestamp or signature headers');
        return false;
    }
    
    // Use SLACK_SIGNING_SECRET for signature verification (fallback to CLIENT_SECRET for backwards compatibility)
    const signingSecret = process.env.SLACK_SIGNING_SECRET || process.env.SLACK_CLIENT_SECRET;
    if (!signingSecret) {
        console.log('No signing secret found - need SLACK_SIGNING_SECRET environment variable');
        return false;
    }
    
    // Convert buffer to string for signature validation
    const body = Buffer.isBuffer(req.body) ? req.body.toString() : req.body;
    console.log('Body string length:', typeof body === 'string' ? body.length : 'not a string');
    console.log('Body preview:', typeof body === 'string' ? body.substring(0, 100) : 'body is not string');
    
    const baseString = `v0:${ts}:${body}`;
    console.log('Base string:', baseString);
    
    const hmac = crypto
        .createHmac('sha256', signingSecret)
        .update(baseString)
        .digest('hex');

    const expectedSig = `v0=${hmac}`;
    console.log('Expected signature:', expectedSig);
    console.log('Received signature:', sig);
    
    const isValid = sig === expectedSig;
    console.log('Signatures match:', isValid);
    console.log('=== End Debug ===');
    
    return isValid;
}

export async function handleSlackEvent(req: Request, res: Response) {
    console.log(chalk.cyan('🔵 [EVENT HANDLER] handleSlackEvent function called'));
    console.log(chalk.cyan('🔵 [EVENT HANDLER] Request method:', req.method));
    console.log(chalk.cyan('🔵 [EVENT HANDLER] Request path:', req.path));
    
    const isValid = isValidSlackSig(req);
    console.log(chalk.cyan('🔵 [EVENT HANDLER] Signature valid:', isValid));
    
    if (!isValid) {
        console.log(chalk.red('❌ [EVENT HANDLER] Invalid signature - returning 400'));
        return res.sendStatus(400);
    }
    
    console.log(chalk.green('✅ [EVENT HANDLER] Signature validated - proceeding to parse body'));

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

    // Log the event type for debugging
    const team_id = body.team_id as string;
    const ev = body.event as Record<string, unknown>;
    const event_id = body.event_id as string | undefined;
    console.log(chalk.blue('Event type:', ev?.type));
    console.log(chalk.blue('Team ID:', team_id));
    if (event_id) {
        console.log(chalk.blue('Event ID:', event_id));
    }

    // For event_callback types, check if we've already processed this event
    if (body.type === 'event_callback' && event_id) {
        const slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: team_id
            }
        });

        if (slackIntegration) {
            // Try to mark this event as processed atomically
            // The unique constraint will prevent duplicate processing even in race conditions
            try {
                await db().processed_slack_events.create({
                    data: {
                        slack_integration_id: slackIntegration.id,
                        event_id: event_id
                    }
                });
                console.log(chalk.green(`✅ New event ${event_id} - processing...`));
            } catch (error: any) {
                // If unique constraint fails, this event was already processed
                if (error.code === 'P2002') {
                    console.log(chalk.yellow(`⚠️  Skipping already processed event ${event_id}`));
                    // Still return 200 OK to Slack to prevent retries
                    return res.sendStatus(200);
                }
                // Re-throw other errors
                throw error;
            }
        }
    }

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

async function handleSlackMessage(event: SlackMessageEvent, teamId: string) {
    try {
        console.log(chalk.blue('Processing Slack message event'), JSON.stringify(event, null, 2));
        
        // Ignore bot messages and messages without text
        if (event.bot_id || !event.text || event.subtype) {
            return;
        }
        
        // Get the Slack integration
        const slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: teamId
            }
        });
        
        if (!slackIntegration) {
            console.log(chalk.yellow('Slack integration not found'));
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
            return;
        }

        // Build SlackEventData from the Slack message event
        // Note: channelName and userName could be fetched from Slack API if needed,
        // but for now we'll use IDs. Permalink could also be constructed if needed.
        const slackEventData: SlackEventData = {
            channelId: event.channel,
            channelName: undefined, // Could fetch from Slack API if needed
            userId: event.user,
            userName: undefined, // Could fetch from Slack API if needed
            text: event.text,
            timestamp: event.ts,
            threadTimestamp: event.thread_ts,
            teamId: teamId,
            permalink: undefined, // Could construct from team/channel/ts if needed
        };

        // Create SlackEvent and process through EventProcessor
        const slackEvent = new SlackEvent(slackEventData);
        const eventProcessor = new EventProcessor(slackEvent, userSlackIntegration.user);
        const results = await eventProcessor.process();

        // Log results (automations will handle their own outputs via NotionOutput, etc.)
        console.log(chalk.green(`Slack message processed - ${results.length} automation(s) matched`));
        for (const result of results) {
            if (result.success) {
                console.log(chalk.green(`  ✓ Automation "${result.automation?.name}" processed successfully`));
            } else {
                console.log(chalk.yellow(`  ⚠ Automation "${result.automation?.name}": ${result.message}`));
            }
        }
        
    } catch (error) {
        console.error(chalk.red('Error handling Slack message:'), error);
        // Note: We don't send error messages back to Slack anymore since this is now
        // event-driven automations, not interactive bot responses
    }
}