import chalk from 'chalk';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { WebClient, LogLevel } from '@slack/web-api';
import { db } from '../prismaClient';
import { SlackEvent } from '../Updater/InputEvents';
import { SlackEventData, SlackChannelType } from '../shared/types';
import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { slack as slackConfig } from '../config/settings';

export function isValidSlackSig(req: Request) {
    const ts = req.headers['x-slack-request-timestamp'] as string;
    const sig = req.headers['x-slack-signature'] as string;
    
    console.log('=== Slack Signature Debug ===');
    console.log('Timestamp:', ts);
    console.log('Signature:', sig);
    console.log('Body type:', Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body);
    console.log('Has SLACK_SIGNING_SECRET:', !!slackConfig.signingSecret);
    console.log('Has SLACK_CLIENT_SECRET:', !!slackConfig.clientSecret);
    
    if (!ts || !sig) {
        console.log('Missing timestamp or signature headers');
        return false;
    }
    
    // Use SLACK_SIGNING_SECRET for signature verification (fallback to CLIENT_SECRET for backwards compatibility)
    const signingSecret = slackConfig.signingSecret || slackConfig.clientSecret;
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

    // IMPORTANT: Acknowledge to Slack immediately (within 3 seconds)
    // Process the event asynchronously in the background to avoid timeouts and retries
    res.sendStatus(200);

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
                    return; // Already acknowledged above
                }
                // Re-throw other errors
                throw error;
            }
        }
    }

    // Process events asynchronously (already acknowledged to Slack)
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
            // Process message asynchronously (fire and forget - errors are logged but don't affect Slack)
            handleSlackMessage(ev as unknown as SlackMessageEvent, team_id, body.authorizations as SlackAuthorizations[]).catch((error) => {
                console.error(chalk.red('Error processing Slack message in background:'), error);
            });
            break;
    }
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

/**
 * Type for Slack API responses that follow the standard { ok: boolean; error?: string } pattern
 */
type SlackApiResponse<T = unknown> = { ok: boolean; error?: string } & T;

/**
 * Type for Promise.allSettled results from Slack API calls
 */
type SlackApiSettledResult<T = unknown> = PromiseSettledResult<SlackApiResponse<T>>;

/**
 * Slack user profile object from users.info API
 */
interface SlackUserProfile {
    avatar_hash?: string;
    status_text?: string;
    status_emoji?: string;
    real_name?: string;
    display_name?: string;
    real_name_normalized?: string;
    display_name_normalized?: string;
    email?: string;
    image_original?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
    team?: string;
}

/**
 * Slack user object from users.info API
 */
interface SlackUser {
    id: string;
    team_id?: string;
    name?: string;
    deleted?: boolean;
    color?: string;
    real_name?: string;
    tz?: string;
    tz_label?: string;
    tz_offset?: number;
    profile?: SlackUserProfile;
    is_admin?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
    is_bot?: boolean;
    updated?: number;
    is_app_user?: boolean;
    has_2fa?: boolean;
}

/**
 * Slack channel/conversation object from conversations.info API
 * Can represent public channels, private channels, DMs, or group DMs
 */
interface SlackChannel {
    id: string;
    name?: string;
    is_channel?: boolean;
    is_group?: boolean;
    is_im?: boolean;
    is_mpim?: boolean;
    is_private?: boolean;
    is_archived?: boolean;
    is_general?: boolean;
    is_shared?: boolean;
    is_org_shared?: boolean;
    is_member?: boolean;
    created?: number;
    creator?: string;
    name_normalized?: string;
    user?: string; // For DMs, the user ID of the other person
    last_read?: string;
    members?: string[];
    topic?: {
        value?: string;
        creator?: string;
        last_set?: number;
    };
    purpose?: {
        value?: string;
        creator?: string;
        last_set?: number;
    };
    previous_names?: string[];
}

/**
 * Helper function to process Promise.allSettled results from Slack API calls
 * Handles fulfilled+ok, rejected, and fulfilled but not ok states
 */
function processSlackApiResult<T>(
    result: SlackApiSettledResult<T>,
    successLabel: string,
    errorPrefix: string
): { success: boolean; data?: T; error?: string } {
    if (result.status === 'fulfilled' && result.value.ok) {
        // Successfully fulfilled and ok
        const { ok, error, ...data } = result.value;
        return { success: true, data: data as T };
    } else if (result.status === 'rejected') {
        // Promise was rejected
        console.warn(chalk.yellow(`⚠ ${errorPrefix}: ${result.reason}`));
        return { success: false, error: String(result.reason) };
    } else if (result.status === 'fulfilled' && !result.value.ok) {
        // Fulfilled but API returned error
        const errorMsg = result.value.error || 'Unknown error';
        console.warn(chalk.yellow(`⚠ ${errorPrefix}: ${errorMsg}`));
        return { success: false, error: errorMsg };
    }
    return { success: false, error: 'Unknown state' };
}

/**
 * Extract channel name from Slack channel info, handling different channel types
 */
function extractChannelName(
    channelResult: { success: boolean; data?: { channel?: SlackChannel }; error?: string },
    userResult: { success: boolean; data?: { user?: SlackUser }; error?: string },
    eventUserId: string,
    defaultChannelId: string
): string | undefined {
    if (!channelResult.success || !channelResult.data?.channel) {
        return undefined;
    }

    const channel = channelResult.data.channel;

    // Handle different channel types
    if ('name' in channel && channel.name) {
        // Public/private channel
        const channelName = channel.name;
        console.log(chalk.green(`✓ Fetched channel name: ${channelName}`));
        return channelName;
    } else if ('is_im' in channel && channel.is_im) {
        // Direct message - try to get user info from the channel user ID
        const dmUserId = 'user' in channel ? channel.user : undefined;
        let channelName: string | undefined;
        
        if (dmUserId && userResult.success && userResult.data?.user) {
            const user = userResult.data.user;
            if (user && dmUserId === eventUserId) {
                // This is a DM with the message sender - use their name
                channelName = user.real_name || user.profile?.display_name || user.name || 'Direct Message';
            }
        }
        
        if (!channelName) {
            channelName = 'Direct Message';
        }
        console.log(chalk.green(`✓ Identified channel as DM: ${channelName}`));
        return channelName;
    } else if ('is_group' in channel && channel.is_group) {
        // Group DM
        const channelName = 'name' in channel && channel.name ? channel.name : 'Group Message';
        console.log(chalk.green(`✓ Identified channel as Group DM: ${channelName}`));
        return channelName;
    } else {
        // Fallback to channel ID
        const channelName = channel.id || defaultChannelId;
        console.log(chalk.yellow(`⚠ Using channel ID as name: ${channelName}`));
        return channelName;
    }
}

/**
 * Extract user name from Slack user info
 */
function extractUserName(
    userResult: { success: boolean; data?: { user?: SlackUser }; error?: string }
): string | undefined {
    if (!userResult.success || !userResult.data?.user) {
        return undefined;
    }

    const user = userResult.data.user;
    // Prefer real_name, fallback to display_name, then name, then id
    const userName = user.real_name || user.profile?.display_name || user.profile?.real_name || user.name || user.id;
    console.log(chalk.green(`✓ Fetched user name: ${userName}`));
    return userName;
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
    // Additional fields that may be present in Slack message events
    edited?: {
        user: string;
        ts: string;
    };
    files?: Array<{
        id: string;
        name: string;
        title: string;
        mimetype: string;
        filetype: string;
        pretty_type: string;
        user: string;
        size: number;
        url_private?: string;
        url_private_download?: string;
        permalink?: string;
        permalink_public?: string;
    }>;
    reactions?: Array<{
        name: string;
        users: string[];
        count: number;
    }>;
    attachments?: Array<{
        fallback?: string;
        color?: string;
        pretext?: string;
        author_name?: string;
        author_link?: string;
        author_icon?: string;
        title?: string;
        title_link?: string;
        text?: string;
        fields?: Array<{
            title: string;
            value: string;
            short: boolean;
        }>;
        image_url?: string;
        thumb_url?: string;
        footer?: string;
        footer_icon?: string;
        ts?: number;
    }>;
    blocks?: unknown[];
    client_msg_id?: string;
    parent_user_id?: string;
    reply_count?: number;
    reply_users?: string[];
    reply_users_count?: number;
    latest_reply?: string;
    team?: string;
    event_ts?: string;
    channel_type?: SlackChannelType;
}

interface SlackAuthorizations {
    enterprise_id: string | null;
    team_id: string;
    user_id: string;
    is_bot: boolean;
    is_enterprise_install: boolean;
}
async function handleSlackMessage(event: SlackMessageEvent, teamId: string, authorizations: SlackAuthorizations[]) {
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

        const hasBotAuthorization = authorizations.find(
            authorization => authorization.is_bot && authorization.user_id === slackIntegration.bot_user_id
        );

        // Get authorization user IDs for explicit user authorization checks
        const authorizationUserIds = authorizations.map(authorization => authorization.user_id);

        // Determine which workspaceUserIntegrations are in play based on channel type and authorization
        // Channel type is available directly on the event
        const channelType = event.channel_type;
        const isPublicChannel = channelType === SlackChannelType.CHANNEL;
        const isPrivateChannel = channelType === SlackChannelType.GROUP;
        const isDM = channelType === SlackChannelType.IM || channelType === SlackChannelType.MPIM;

        let workspaceUserIntegrations;
        
        if (isPublicChannel && hasBotAuthorization) {
            // Public channel with bot authorization: all workspaceUserIntegrations in the space are in play
            console.log(chalk.blue('Public channel with bot authorization - including all workspace users'));
            workspaceUserIntegrations = await db().user_slack_integrations.findMany({
                where: {
                    slack_team_id: teamId
                },
                include: {
                    user: true
                }
            });
        } else if (isPrivateChannel || isDM) {
            // Private channel or DM: only workspaceUserIntegrations with explicit user authorization
            const channelTypeName = isPrivateChannel ? 'Private channel' : 'DM';
            console.log(chalk.blue(`${channelTypeName} - including only explicitly authorized users`));
            workspaceUserIntegrations = await db().user_slack_integrations.findMany({
                where: {
                    slack_team_id: teamId,
                    authed_user_id: {
                        in: authorizationUserIds
                    }
                },
                include: {
                    user: true
                }
            });
        } else {
            // Public channel without bot authorization or unknown type: use explicit authorization
            console.log(chalk.blue(`${channelType || 'Unknown channel type'} - including only explicitly authorized users`));
            workspaceUserIntegrations = await db().user_slack_integrations.findMany({
                where: {
                    slack_team_id: teamId,
                    authed_user_id: {
                        in: authorizationUserIds
                    }
                },
                include: {
                    user: true
                }
            });
        }
        
        if (workspaceUserIntegrations.length === 0) {
            console.log(chalk.yellow('No users found with Slack integrations for this workspace'));
            return;
        }

        const authedUserAccessToken = workspaceUserIntegrations[0].authed_user_access_token;
        if (!authedUserAccessToken) {
            console.log(chalk.yellow('No authed user access token found for user'));
            return;
        }

        // Initialize Slack WebClient to fetch additional data
        const client = new WebClient(authedUserAccessToken, {
            logLevel: LogLevel.INFO
        });

        console.log(chalk.blue(`📡 Fetching additional Slack data for channel ${event.channel}, user ${event.user}, message ${event.ts}`));

        // Fetch all available data from Slack API in parallel
        const [channelInfo, userInfo, permalinkResult] = await Promise.allSettled([
            // Fetch channel information
            client.conversations.info({
                channel: event.channel
            }),
            // Fetch user information
            client.users.info({
                user: event.user
            }),
            // Get message permalink
            client.chat.getPermalink({
                channel: event.channel,
                message_ts: event.ts
            })
        ]);

        // Process all API results
        const channelResult = processSlackApiResult<{ channel?: SlackChannel }>(
            channelInfo as SlackApiSettledResult<{ channel?: SlackChannel }>,
            'Channel info',
            'Failed to fetch channel info'
        );
        
        const userResult = processSlackApiResult<{ user?: SlackUser }>(
            userInfo as SlackApiSettledResult<{ user?: SlackUser }>,
            'User info',
            'Failed to fetch user info'
        );

        const permalinkApiResult = processSlackApiResult<{ permalink?: string }>(
            permalinkResult as SlackApiSettledResult<{ permalink?: string }>,
            'Message permalink',
            'Failed to fetch message permalink'
        );
        
        // Extract channel name and metadata
        const channelName = extractChannelName(channelResult, userResult, event.user, event.channel);

        // Extract user information
        const userName = extractUserName(userResult);

        // Extract permalink
        const permalink = permalinkApiResult.success ? permalinkApiResult.data?.permalink : undefined;
        if (permalink) {
            console.log(chalk.green(`✓ Fetched message permalink: ${permalink}`));
        }

        // Build SlackEventData with all available information
        const slackEventData: SlackEventData = {
            channelId: event.channel,
            channelName: channelName,
            userId: event.user,
            userName: userName,
            text: event.text,
            timestamp: event.ts,
            threadTimestamp: event.thread_ts,
            teamId: teamId,
            permalink: permalink,
            channelType: event.channel_type
        };

        // Create SlackEvent once
        const slackEvent = new SlackEvent(slackEventData);
        
        // Process the event against automations for all users in this workspace
        // This ensures messages from any workspace user can trigger automations
        let totalMatches = 0;
        for (const userSlackIntegration of workspaceUserIntegrations) {
            try {
                const eventProcessor = new EventProcessor(slackEvent, userSlackIntegration.user);
                const results = await eventProcessor.process();
                
                // Log results for this user
                if (results.length > 0 && results.some(r => r.success || r.automation !== null)) {
                    totalMatches += results.filter(r => r.success || r.automation !== null).length;
                    console.log(chalk.green(`User ${userSlackIntegration.user.email}: ${results.length} automation(s) matched`));
                    for (const result of results) {
                        if (result.success) {
                            console.log(chalk.green(`  ✓ Automation "${result.automation?.name}" processed successfully`));
                        } else if (result.automation) {
                            console.log(chalk.yellow(`  ⚠ Automation "${result.automation.name}": ${result.message}`));
                        }
                    }
                }
            } catch (error) {
                console.error(chalk.red(`Error processing automations for user ${userSlackIntegration.user.email}:`), error);
                // Continue processing other users even if one fails
            }
        }
        
        console.log(chalk.green(`Slack message processed - ${totalMatches} total automation(s) matched across all workspace users`));
        
    } catch (error) {
        console.error(chalk.red('Error handling Slack message:'), error);
        // Note: We don't send error messages back to Slack anymore since this is now
        // event-driven automations, not interactive bot responses
    }
}