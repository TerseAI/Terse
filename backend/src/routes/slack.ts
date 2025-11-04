import { Request, Response } from "express";
import { db } from "../prismaClient";
import { SlackChannelsResponse, SlackChannel } from "../shared/types";
import { WebClient, LogLevel } from "@slack/web-api";
import chalk from "chalk";

// Fetch available channels for a Slack integration
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

