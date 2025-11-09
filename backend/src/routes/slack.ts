import { Request, Response } from "express";
import { db } from "../prismaClient";
import { SlackChannelsResponse, SlackChannel } from "../shared/types";
import { WebClient, LogLevel } from "@slack/web-api";
import chalk from "chalk";
import { cacheService } from "../services/cacheService";
import { resolveTtlMs } from "../services/cacheConfig";

const DEFAULT_SLACK_CHANNELS_TTL_MS = 5 * 60 * 1000;

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

    const forceRefresh = req.query.forceRefresh === "true";
    const skipCache = req.query.skipCache === "true";
    const cacheKey = `slack:channels:${integrationId}`;
    const ttlMs = resolveTtlMs(process.env.CACHE_SLACK_CHANNELS_TTL_MS, DEFAULT_SLACK_CHANNELS_TTL_MS);

    const cacheResult = await cacheService.getOrFetch<SlackChannelsResponse>({
      key: cacheKey,
      source: "slack",
      ttlMs,
      metadata: {
        integrationId,
        userId: user.id,
        teamId: userSlackIntegration.slack_integration?.team_id ?? null,
      },
      forceRefresh,
      skipCache,
      allowStaleOnError: true,
      fetcher: async () => {
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

        const appendChannels = (
          slackChannels: typeof publicChannels,
          options: { isPrivate: boolean; isMPIM: boolean },
        ) => {
          if (!slackChannels.ok || !slackChannels.channels) {
            return;
          }

          for (const channel of slackChannels.channels) {
            if (channel?.id && channel?.name) {
              channels.push({
                id: channel.id,
                name: channel.name,
                isPrivate: options.isPrivate,
                isArchived: channel.is_archived || false,
                isMPIM: options.isMPIM,
              });
            }
          }
        };

        appendChannels(publicChannels, { isPrivate: false, isMPIM: false });
        appendChannels(privateChannels, { isPrivate: true, isMPIM: false });
        appendChannels(mpimChannels, { isPrivate: true, isMPIM: true });

        channels.sort((a, b) => a.name.localeCompare(b.name));

        const response: SlackChannelsResponse = {
          channels,
          selectedChannelId: null,
        };

        console.log(
          chalk.blue(`📋 Refreshed ${channels.length} Slack channels for integration ${integrationId}`),
        );

        return response;
      },
    });

    if (cacheResult.cacheHit) {
      console.log(
        chalk.blue(
          `♻️ Served Slack channels for integration ${integrationId} from cache (count=${cacheResult.data.channels.length})`,
        ),
      );
    }

    res.status(200).json(cacheResult.data);
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

