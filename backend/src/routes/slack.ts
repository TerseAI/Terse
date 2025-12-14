import { Request, Response } from "express";
import { db } from "../prismaClient";
import { SlackChannelsResponse, SlackChannel } from "../shared/types";
import { WebClient, LogLevel } from "@slack/web-api";
import { Channel } from "@slack/web-api/dist/types/response/ConversationsListResponse";
import chalk from "chalk";
import { User, UserSlackIntegrationWithUser } from "../types/prisma";
import { SlackIntegrationManager, isValidSlackSig, SlackMessageEvent } from '../integrations/SlackIntegration';
import logger from "../logger";

// MARK: - Route Handlers

export async function getSlackIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const manager = new SlackIntegrationManager();
    const integrations = await manager.getInstancesForUser(req.session.user.id);
    res.status(200).json(integrations);
  } catch (error) {
    logger.error('Error fetching Slack integrations', { error, userId: req.session?.user?.id });
    res.status(500).json({ error: 'Failed to fetch Slack integrations' });
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
  const integration = new SlackIntegrationManager();
  await integration.processInstallationCallback(req, res);
}


const getToken = (integration: UserSlackIntegrationWithUser) => {
  return integration.authed_user_access_token || integration.slack_integration.access_token;
}

/**
 * Handle incoming Slack webhook events
 * Validates signature, parses JSON, handles URL verification, and processes events
 */
export async function handleSlackWebhook(req: Request, res: Response): Promise<void> {
  // Validate Slack signature
  const isValid = isValidSlackSig(req);

  if (!isValid) {
    logger.warn('❌ [SLACK WEBHOOK] Invalid signature - returning 400');
    res.sendStatus(400);
    return;
  }

  // Parse JSON from raw body (req.body is a Buffer from express.raw())
  // Express.raw() gives us a Buffer, which we convert to string and parse as JSON
  let body: SlackMessageEvent;
  try {
    const rawBody = req.body as Buffer;
    body = JSON.parse(rawBody.toString('utf8')) as unknown as SlackMessageEvent;
  } catch (error) {
    logger.error('Failed to parse Slack event body', { error });
    res.sendStatus(400);
    return;
  }

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
    logger.error('Error processing Slack webhook event', { error });
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
        user: true,
      },
    });

    if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
      return res.status(404).json({ error: "Slack integration not found" });
    }

    const token = getToken(userSlackIntegration);
    const isBotUser = userSlackIntegration.is_bot_user;
    const teamName = userSlackIntegration.slack_integration.team_name;
    const authedUserId = userSlackIntegration.authed_user_id;
    const teamId = userSlackIntegration.slack_team_id;

    logger.debug(`🔵 [SLACK CHANNELS] integration: team="${teamName}", user_id="${authedUserId}", team_id="${teamId}"`, { teamName, authedUserId, teamId, integrationId });

    // Fetch channels from Slack API
    const client = new WebClient(token, {
      logLevel: LogLevel.ERROR,
    });

    // Fetch both public and private channels the bot has access to
    const [publicChannels, privateChannels, mpimChannels] = await Promise.all([
      client.conversations.list({
        types: "public_channel",
        exclude_archived: true,
        limit: 1000,
      }),
      client.conversations.list({
        types: "private_channel",
        exclude_archived: true,
        limit: 1000,
      }),
      client.conversations.list({
        types: "mpim",
        exclude_archived: true,
        limit: 1000,
      }),
    ]);

    const formatChannelSummary = (channels: Channel[] | undefined, type: string) => 
      channels?.map(c => `${c.name}(is_member=${c.is_member})`).join(', ') || 'none';
    
    logger.debug(`🔵 [SLACK CHANNELS] public: ${publicChannels.channels?.length || 0}`, { publicCount: publicChannels.channels?.length || 0, summary: formatChannelSummary(publicChannels.channels as Channel[], 'public'), integrationId });
    logger.debug(`🔵 [SLACK CHANNELS] private: ${privateChannels.channels?.length || 0}`, { privateCount: privateChannels.channels?.length || 0, summary: formatChannelSummary(privateChannels.channels as Channel[], 'private'), integrationId });
    logger.debug(`🔵 [SLACK CHANNELS] mpim: ${mpimChannels.channels?.length || 0}`, { mpimCount: mpimChannels.channels?.length || 0, summary: formatChannelSummary(mpimChannels.channels as Channel[], 'mpim'), integrationId });

    const channels: SlackChannel[] = [];

    if (publicChannels.ok && publicChannels.channels) {
      for (const channel of publicChannels.channels) {
        if (channel.id && channel.name && (!isBotUser || channel.is_member)) {
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

    res.status(200).json(response);
  } catch (error: any) {
    logger.error("Error fetching Slack channels", { error, integrationId, userId: user.id });

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

export async function handleSlackInteraction(req: Request, res: Response) {
  res.sendStatus(200);
  return;
}

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
    logger.error('Error opening chat', { error, authedUserId });
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
