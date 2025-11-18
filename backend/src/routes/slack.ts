import axios from "axios";
import { Request, Response } from "express";
import { db } from "../prismaClient";
import { SlackChannelsResponse, SlackChannel } from "../shared/types";
import { WebClient, LogLevel } from "@slack/web-api";
import chalk from "chalk";
import { User } from "../types/prisma";
import { Jwt } from "../utility/jwt";
import { slack as slackConfig, urls } from "../config/settings";
import { SlackIntegrationManager, isValidSlackSig, SlackMessageEvent } from '../integrations/SlackIntegration';

// MARK: - Route Handlers

/**
 * Generate Slack OAuth URL for user authorization
 */
export async function getSlackOAuthUrl(req: Request, res: Response) {
    const client_id = slackConfig.clientId;
    const redirect_uri = slackConfig.oauthCallbackUrl;

    console.log('redirect_uri', redirect_uri)

    if (!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const scope = "channels:history,channels:manage,groups:history,groups:write,im:history,im:write,mpim:history,mpim:write";
    const user_scope = "channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read,channels:write,groups:write,mpim:write,im:write"

    // create JWT and attach to url as state
    const jwt = new Jwt();
    const jwtToken = await jwt.sign(user.id);

    const state = encodeURIComponent(jwtToken);

    try {
        const encodedRedirectUri = encodeURIComponent(redirect_uri);
        const url = `https://slack.com/oauth/v2/authorize?scope=${scope}&user_scope=${user_scope}&redirect_uri=${encodedRedirectUri}&client_id=${client_id}&state=${state}`;
        console.log("Slack OAuth URL", url);

        res.json({
            url
        });
    } catch (error) {
        console.error('Error generating installation URL:', error);
        res.status(500).json({ message: 'Failed to generate installation URL' });
    }
}

/**
 * Get current Slack integration for the authenticated user
 */
export async function getCurrentSlackIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            user_id: user.id
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (!userSlackIntegration) {
        res.status(404).json({ teamName: null });
        return;
    }

    const slackIntegration = await db().slack_integrations.findFirst({
        where: {
            team_id: userSlackIntegration?.slack_team_id
        }
    });

    if (!slackIntegration || !userSlackIntegration) {
        res.status(404).json({ teamName: null });
        return;
    }

    res.status(200).json({ teamName: slackIntegration.team_name });
}

/**
 * Handle Slack OAuth callback
 */
export async function slackOAuthCallback(req: Request, res: Response) {
    const frontendUrl = urls.frontend;

    // Check if Slack returned an error (user denied access, etc.)
    if (req.query.error) {
        console.error("Slack OAuth error:", req.query.error);
        return res.redirect(`${frontendUrl}/oauth/error`);
    }

    // grab temporary code from query
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
        console.error("Missing code or state in OAuth callback");
        return res.redirect(`${frontendUrl}/oauth/error`);
    }

    const jwt = new Jwt();
    const user = await jwt.verify(state);

    if (!user) {
        console.error("Invalid or expired state token");
        return res.redirect(`${frontendUrl}/oauth/error`);
    }

    const client_id = slackConfig.clientId;
    const client_secret = slackConfig.clientSecret;
    const redirect_uri = slackConfig.oauthCallbackUrl;

    try {
        const response = await axios.post<SlackOAuthResponse>('https://slack.com/api/oauth.v2.access',
            {
                code: code,
                client_id: client_id,
                client_secret: client_secret,
                redirect_uri: redirect_uri,
            }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        );

        console.log("Slack OAuth response:", response.data);

        const { access_token, authed_user, team } = response.data;

        if (!response.data.ok || !team || !team.id) {
            console.error("Slack OAuth response not ok:", response.data);
            return res.redirect(`${frontendUrl}/oauth/error`);
        }

        // check if the slack integration already exists
        let slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: team.id
            }
        });

        await db().$transaction(async (tx) => {
            if (slackIntegration) {
                console.log("Slack integration already exists, continuing with adding user relation");
                // Update existing integration with user_scope
                await db().slack_integrations.update({
                    where: {
                        team_id: slackIntegration.team_id
                    },
                    data: {
                        app_id: response.data.app_id,
                        bot_user_id: response.data.bot_user_id,
                        team_id: response.data.team.id,
                        team_name: response.data.team.name,
                        access_token: access_token,
                    }
                });
            } else {
                console.log(chalk.blue("Slack integration does not exist, creating it"));
                slackIntegration = await db().slack_integrations.create({
                    data: {
                        app_id: response.data.app_id,
                        bot_user_id: response.data.bot_user_id,
                        team_id: response.data.team.id,
                        team_name: response.data.team.name,
                        access_token: access_token,
                    }
                });
                console.log(chalk.green("Slack integration created"));
            }

            const dmChannelId = await openChat(access_token, authed_user.id);

            if (!dmChannelId || !dmChannelId.id) {
                console.error("Error opening chat");
                throw new Error('Failed to open chat');
            }

            await db().user_slack_integrations.upsert({
                where: {
                    user_id_slack_team_id: {
                        user_id: user.id,
                        slack_team_id: slackIntegration.team_id,
                    }
                },
                update: {
                    authed_user_id: authed_user.id,
                    authed_user_access_token: authed_user.access_token,
                },
                create: {
                    user_id: user.id,
                    slack_team_id: slackIntegration.team_id,
                    authed_user_id: authed_user.id,
                    authed_user_access_token: authed_user.access_token,
                }
            });
        });

        console.log("Slack OAuth completed successfully");
        return res.redirect(`${frontendUrl}/oauth/success`);
    } catch (error) {
        console.error('Error exchanging code for access token:', error);
        return res.redirect(`${frontendUrl}/oauth/error`);
    }
}

/**
 * Handle incoming Slack webhook events
 * Validates signature, parses JSON, handles URL verification, and processes events
 */
export async function handleSlackWebhook(req: Request, res: Response): Promise<void> {
    console.log(chalk.cyan('🔵 [SLACK WEBHOOK] handleSlackWebhook called'));
    console.log(chalk.cyan('🔵 [SLACK WEBHOOK] Request method:', req.method));
    console.log(chalk.cyan('🔵 [SLACK WEBHOOK] Request path:', req.path));
    
    // Validate Slack signature
    const isValid = isValidSlackSig(req);
    console.log(chalk.cyan('🔵 [SLACK WEBHOOK] Signature valid:', isValid));
    
    if (!isValid) {
        console.log(chalk.red('❌ [SLACK WEBHOOK] Invalid signature - returning 400'));
        res.sendStatus(400);
        return;
    }
    
    console.log(chalk.green('✅ [SLACK WEBHOOK] Signature validated - parsing body'));

    // Parse JSON from raw body (req.body is a Buffer from express.raw())
    // Express.raw() gives us a Buffer, which we convert to string and parse as JSON
    let body: SlackMessageEvent;
    try {
        const rawBody = req.body as Buffer;
        body = JSON.parse(rawBody.toString('utf8')) as unknown as SlackMessageEvent;
    } catch (error) {
        console.error('Failed to parse Slack event body:', error);
        res.sendStatus(400);
        return;
    }

    console.log(chalk.green('Slack event received', JSON.stringify(body, null, 2)));

    // Handle URL verification challenge (must respond immediately)
    if (body.type === 'url_verification') {
        const challenge = (body as unknown as { challenge: string }).challenge;
        res.send(challenge);
        return;
    }

    // IMPORTANT: Acknowledge to Slack immediately (within 3 seconds)
    // Process the event asynchronously in the background to avoid timeouts and retries
    res.sendStatus(200);

    // Process the event asynchronously
    const slackIntegrationManager = new SlackIntegrationManager();
    slackIntegrationManager.processWebhookEvent(body).catch((error) => {
        console.error(chalk.red('Error processing Slack webhook event:'), error);
    });
}

/**
 * Fetch available channels for a Slack integration
 */
export const getSlackChannels = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const integrationId = req.query.integrationId as string;
  if (!integrationId) {
    return res.status(400).json({ error: "integrationId is required" });
  }

  try {
    // Verify user owns this integration
    // For Slack, integrationId is user_slack_integrations.id
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
      where: {
        id: integrationId,
        user_id: user.id,
      },
      include: {
        slack_integration: true,
      },
    });

    if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
      return res.status(404).json({ error: "Slack integration not found" });
    }

    const slackIntegration = userSlackIntegration.slack_integration;

    // Fetch channels from Slack API
    const client = new WebClient(userSlackIntegration.authed_user_access_token, {
      logLevel: LogLevel.ERROR,
    });

    // Fetch both public and private channels the bot has access to
    const [publicChannels, privateChannels, mpimChannels] = await Promise.all([
      client.conversations.list({
        types: "public_channel",
        exclude_archived: true,
      }),
      client.conversations.list({
        types: "private_channel",
        exclude_archived: true,
      }),
      client.conversations.list({
        types: "mpim",
        exclude_archived: true,
      }),
    ]);

    const channels: SlackChannel[] = [];

    if (publicChannels.ok && publicChannels.channels) {
      for (const channel of publicChannels.channels) {
        if (channel.id && channel.name) {
          channels.push({
            id: channel.id,
            name: channel.name,
            isPrivate: false,
            isArchived: channel.is_archived || false,
            isMPIM: false,
          });
        }
      }
    }

    if (privateChannels.ok && privateChannels.channels) {
      for (const channel of privateChannels.channels) {
        if (channel.id && channel.name) {
          channels.push({
            id: channel.id,
            name: channel.name,
            isPrivate: true,
            isArchived: channel.is_archived || false,
            isMPIM: false,
          });
        }
      }
    }

    if (mpimChannels.ok && mpimChannels.channels) {
      for (const channel of mpimChannels.channels) {
        if (channel.id && channel.name) {
          channels.push({
            id: channel.id,
            name: channel.name,
            isPrivate: true,
            isArchived: channel.is_archived || false,
            isMPIM: true,
          });
        }
      }
    }

    // Sort channels alphabetically by name
    channels.sort((a, b) => a.name.localeCompare(b.name));

    const response: SlackChannelsResponse = {
      channels,
      selectedChannelId: null, // We don't store a default channel at the connection level
    };

    console.log(
      chalk.blue(`📋 Found ${channels.length} Slack channels for integration ${integrationId}`)
    );

    res.status(200).json(response);
  } catch (error: any) {
    console.error(chalk.red("Error fetching Slack channels:"), error);

    // Check if this is an invalid_auth error from Slack
    const isInvalidAuth =
      (error?.data?.error === 'invalid_auth') ||
      (error?.code === 'slack_webapi_platform_error' && error?.data?.error === 'invalid_auth');

    if (isInvalidAuth) {
      return res.status(401).json({
        error: "Slack authentication failed",
        details: "The Slack integration token is invalid or expired. Please reconnect your Slack integration.",
        code: "SLACK_INVALID_AUTH",
      });
    }

    res.status(500).json({
      error: "Failed to fetch channels",
      details: error.message,
    });
  }
};

// MARK: - Helper Functions

/**
 * Helper function to open a DM channel with a user
 */
async function openChat(accessToken: string, authedUserId: string) {
    try {
        const client = new WebClient(accessToken, {
            logLevel: LogLevel.DEBUG
        });

        const { channel } = await client.conversations.open({
            users: authedUserId
        });

        return channel;
    } catch (error) {
        console.error('Error opening chat:', error);
        return null;
    }
}

// MARK: - Types

/**
 * Slack OAuth response interface
 */
export interface SlackOAuthResponse {
    ok: boolean;
    access_token: string;
    token_type: string;
    bot_user_id: string;
    app_id: string;
    team: {
        name: string;
        id: string;
    };
    enterprise: {
        name: string;
        id: string;
    };
    authed_user: {
        id: string;
        access_token: string;
        token_type: string;
    };
}
