import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import { User, ChannelInputWithConfigs } from "../types/prisma";
import { figma_integrations, InputConfigType, IntegrationType as PrismaIntegrationType } from "@prisma/client";
import { generateWebhookPasscode } from "../utility/webhookSecrets";
import { nodeEnv } from "../config/settings";
import chalk from "chalk";
import { EventProcessor } from "../agent/ChannelAgent/EventProcessor";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { InputEvent } from "./abstract/InputEvent";
import {
  FigmaCommentEventData,
  FigmaCommentThreadEntry,
  FigmaEventTypes,
  FigmaCommentImageUrls,
  FigmaWebhookUser,
  FigmaPositioningData,
  FigmaApiComment,
  OAuthInstallationDetails,
} from "../shared/types";
import { FigmaIntegration, FigmaIntegrationMetadata, IntegrationType } from "../shared/Integrations";
import jwt from "jsonwebtoken";
import { figma as figmaConfig, jwt as jwtConfig, urls } from "../config/settings";
import { Request, Response } from "express";

export class FigmaIntegrationManager implements Integration<FigmaIntegration, FigmaWebhookEvent, typeof FigmaIntegrationMetadata>, OAuthIntegrationInstallation {
  constructor() { }
  integrationType: IntegrationType = IntegrationType.FIGMA;

  async getInstancesForUser(userId: string): Promise<FigmaIntegration[]> {
    const integrations = await db().figma_integrations.findMany({
      where: {
        user_id: userId,
      },
    });
    return integrations.map(integration => ({
      id: integration.id,
      handle: integration.handle,
      figma_user_id: integration.figma_user_id,
      token_expiry: integration.token_expiry,
    }));
  }

  async processWebhookEvent(event: FigmaWebhookEvent): Promise<void> {
    const eventType = event.event_type;

    const supportedEventTypes = Object.values(FigmaEventTypes);
    if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
      console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType}`));
      return;
    }

    const receivedPasscode = event.passcode;

    const integrations = await db().figma_integrations.findMany({
      where: {
        figma_webhooks: {
          some: {
            passcode: receivedPasscode,
          },
        },
      },
      include: {
        user: true,
      },
    });

    if (integrations.length === 0) {
      console.log(chalk.yellow(`⚠️  No integrations found with matching passcode`));
      return;
    }

    for (const integration of integrations) {
      if (eventType === FigmaEventTypes.FILE_COMMENT) {
        await handleFigmaCommentEvent(integration, event, integration.user);
      }
    }
  }

  async getInstallationUrl(userId: string): Promise<OAuthInstallationDetails> {
    // Generate state token for security (prevents CSRF)
    const state = jwt.sign(
      { userId: userId, timestamp: Date.now() },
      jwtConfig.secret,
      { expiresIn: "10m" }
    );

    const scope = "current_user:read,file_comments:read,file_content:read,file_metadata:read,file_versions:read,library_assets:read,library_content:read,team_library_content:read,file_dev_resources:read,projects:read,webhooks:read,webhooks:write";

    // Build OAuth URL with proper encoding
    const authUrl = new URL("https://www.figma.com/oauth");
    authUrl.searchParams.append("client_id", figmaConfig.clientId);
    authUrl.searchParams.append("redirect_uri", figmaConfig.redirectUrl);
    authUrl.searchParams.append("scope", scope);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("response_type", "code");

    return {
      oauthUrl: authUrl.toString()
    };
  }

  async processInstallationCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query;

    if (error) {
      console.error(chalk.red("Figma OAuth error:"), error);
      res.redirect(`${urls.frontend}/oauth/error`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: "Missing code or state parameter" });
      return;
    }
    try {
      // Verify state token to prevent CSRF attacks
      const decoded = jwt.verify(state as string, jwtConfig.secret) as {
        userId: string;
        timestamp: number;
      };

      // Exchange authorization code for access token
      // Figma requires application/x-www-form-urlencoded format
      const params = new URLSearchParams({
        redirect_uri: figmaConfig.redirectUrl,
        code: code as string,
        grant_type: "authorization_code",
      });

      const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${figmaConfig.clientId}:${figmaConfig.clientSecret}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(chalk.red("Figma token exchange failed:"), errorText);
        throw new Error(`Figma token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_in, user_id_string } = tokenData;

      console.log(
        chalk.blue("🔑 Received Figma access token for user"),
        chalk.yellow(decoded.userId)
      );
      console.log(
        chalk.blue("👤 Figma User ID:"),
        chalk.yellow(user_id_string)
      );
      console.log(
        chalk.blue("Expires in:"),
        chalk.yellow(expires_in)
      );

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + (expires_in * 1000));


      let handle: string;
      const userInfoResponse = await fetch("https://api.figma.com/v1/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
        },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        handle = userInfo.handle
      } else {
        throw new Error(`Failed to fetch Figma user info: ${userInfoResponse.statusText}`);
      }

      // Check if a connection for this Figma user already exists
      const existing = await db().figma_integrations.findFirst({
        where: {
          user_id: decoded.userId,
          figma_user_id: user_id_string,
        },
      });

      if (!existing) {
        await db().figma_integrations.create({
          data: {
            user_id: decoded.userId,
            figma_user_id: user_id_string,
            handle: handle,
            access_token: access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry,
          },
        });
        console.log(
          chalk.green("✅ Created Figma connection for user"),
          chalk.yellow(decoded.userId)
        );
      } else {
        // Update existing connection with new token (in case it was revoked and re-authorized)
        await db().figma_integrations.update({
          where: { id: existing.id },
          data: {
            handle: handle,
            figma_user_id: user_id_string,
            access_token: access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry,
          },
        });
        console.log(
          chalk.green("✅ Updated Figma connection token for user"),
          chalk.yellow(decoded.userId)
        );
      }

      console.log(
        chalk.green("✅ Figma OAuth completed for user"),
        chalk.yellow(decoded.userId)
      );

      // Redirect to success page which will auto-close the popup
      res.redirect(`${urls.frontend}/oauth/success`);
    } catch (error) {
      console.error(chalk.red("Error in Figma OAuth callback:"), error);
      res.redirect(`${urls.frontend}/oauth/error`);
    }
  }

  deleteInstallation(integrationId: string): Promise<void> {
    return Promise.resolve();
  }

  async setupChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
    // Check if figma_config exists at all
    if (!channelInput.figma_config) {
      console.log(chalk.yellow(`⚠️  No Figma config found for input ${channelInput.id}. Skipping webhook setup.`));
      return;
    }

    const fileKey = channelInput.figma_config.file_key;

    if (!fileKey) {
      console.log(chalk.yellow(`⚠️  No file_key specified in Figma config for input ${channelInput.id}`));
      return;
    }

    // Get Figma integration
    const figmaIntegration = await db().figma_integrations.findFirst({
      where: { id: integrationId },
    });

    if (!figmaIntegration) {
      console.log(chalk.yellow(`⚠️  Figma integration not found: ${integrationId}`));
      return;
    }

    // Get team ID from config - required for webhook creation
    const teamId = channelInput.figma_config.team_id;

    if (!teamId) {
      throw new Error(`team_id is required for creating Figma webhooks. Please provide a team ID in the Figma configuration for file ${fileKey}.`);
    }

    // Build webhook endpoint URL
    const webhookEndpoint = `${urls.backend}/webhooks/figma`;

    // Event types to monitor: comments
    const eventTypes = ['FILE_COMMENT'];

    try {
      const accessToken = figmaIntegration.access_token;
      const isDevelopment = nodeEnv !== 'production';

      // Create or reuse team-level webhooks for both event types
      for (const eventType of eventTypes) {
        // Check if a team-level webhook already exists for this team and event type
        const existingWebhook = await db().figma_webhooks.findFirst({
          where: {
            figma_integration_id: figmaIntegration.id,
            team_id: teamId,
            event_type: eventType,
          },
        });

        // In development, always delete and recreate webhooks
        if (isDevelopment && existingWebhook) {
          console.log(
            chalk.yellow(`🔄 Development mode: Deleting existing webhook ${existingWebhook.webhook_id} for team ${teamId}, event ${eventType}`)
          );

          // Delete webhook from Figma API
          try {
            const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${existingWebhook.webhook_id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            });

            if (!deleteResponse.ok && deleteResponse.status !== 404) {
              const errorText = await deleteResponse.text();
              console.error(chalk.red(`Failed to delete existing Figma webhook ${existingWebhook.webhook_id}: ${errorText}`));
            } else {
              console.log(chalk.green(`✅ Deleted existing webhook ${existingWebhook.webhook_id}`));
            }
          } catch (error) {
            console.error(chalk.red(`❌ Error deleting existing webhook ${existingWebhook.webhook_id}:`), error);
          }

          // Delete webhook record from database
          await db().figma_webhooks.delete({
            where: { id: existingWebhook.id },
          });
        } else if (existingWebhook) {
          // In production, reuse existing webhook
          console.log(
            chalk.blue(`ℹ️  Team-level webhook already exists for team ${teamId}, event ${eventType}. Reusing existing webhook ${existingWebhook.webhook_id}`)
          );
          continue; // Webhook already exists, skip creation
        }

        // Generate secure passcode for webhook verification
        const passcode = generateWebhookPasscode();

        // Create team-level webhook (no file_key - monitors entire team)
        const webhookResponse = await fetch('https://api.figma.com/v2/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: eventType,
            team_id: teamId,
            // No file_key - this is a team-level webhook
            endpoint: webhookEndpoint,
            passcode: passcode,
          }),
        });

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text();
          console.error(chalk.red(`Failed to create Figma webhook for ${eventType}: ${errorText}`));
          throw new Error(`Failed to create Figma webhook for ${eventType}: ${errorText}`);
        }

        const webhookData = await webhookResponse.json();
        const webhookId = webhookData.webhook?.id || webhookData.id;

        if (!webhookId) {
          throw new Error(`Webhook ID not returned from Figma API for ${eventType}`);
        }

        // Store team-level webhook in database
        await db().figma_webhooks.create({
          data: {
            figma_integration_id: figmaIntegration.id,
            webhook_id: webhookId,
            team_id: teamId,
            endpoint_url: webhookEndpoint,
            passcode: passcode,
            event_type: eventType,
          },
        });

        console.log(
          chalk.green(`✅ Created team-level Figma webhook ${webhookId} for team ${teamId}, event ${eventType}`)
        );
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error creating Figma webhooks for team ${teamId}:`), error);
      throw error;
    }
  }

  async teardownChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
    const teamId = channelInput.figma_config?.team_id;

    if (!teamId) {
      console.log(chalk.blue(`ℹ️  No team_id in config, skipping webhook cleanup for channel input ${channelInput.id}`));
      return;
    }

    // Get Figma integration
    const figmaIntegration = await db().figma_integrations.findFirst({
      where: { id: integrationId },
    });

    if (!figmaIntegration) {
      console.log(chalk.yellow(`⚠️  Figma integration not found: ${integrationId}`));
      return;
    }

    // Check if any other active automations are using this team
    const otherAutomations = await db().automation_inputs.findMany({
      where: {
        config_type: InputConfigType.FIGMA,
        automation: {
          is_active: true,
        },
        NOT: {
          id: channelInput.id,
        },
      },
      include: {
        figma_config: true,
      },
    });

    // Check if any other active channel uses the same team
    const otherTeamUsers = otherAutomations.filter(
      (input) => input.figma_config?.team_id === teamId
    );

    if (otherTeamUsers.length > 0) {
      console.log(
        chalk.blue(`ℹ️  Team ${teamId} still in use by ${otherTeamUsers.length} other automation(s). Keeping team-level webhooks.`)
      );
      return; // Don't delete webhooks, other automations are using them
    }

    // No other automations use this team, so we can delete the team-level webhooks
    const webhooks = await db().figma_webhooks.findMany({
      where: {
        figma_integration_id: figmaIntegration.id,
        team_id: teamId,
      },
    });

    if (webhooks.length === 0) {
      console.log(chalk.blue(`ℹ️  No webhooks found for team ${teamId}`));
      return;
    }

    const accessToken = figmaIntegration.access_token;
    if (!accessToken) {
      console.log(chalk.yellow(`⚠️  No access token found, skipping webhook deletion`));
      return;
    }

    // Delete all team-level webhooks for this team
    for (const webhook of webhooks) {
      try {
        const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${webhook.webhook_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          // 404 means webhook already deleted, which is fine
          const errorText = await deleteResponse.text();
          console.error(chalk.red(`Failed to delete Figma webhook ${webhook.webhook_id} (${webhook.event_type}): ${errorText}`));
        } else {
          console.log(chalk.green(`✅ Deleted team-level Figma webhook ${webhook.webhook_id} (${webhook.event_type}) for team ${teamId}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error deleting Figma webhook ${webhook.webhook_id}:`), error);
        // Continue with database cleanup even if API call fails
      }
    }

    // Delete webhook records from database
    await db().figma_webhooks.deleteMany({
      where: {
        figma_integration_id: figmaIntegration.id,
        team_id: teamId,
      },
    });

    console.log(chalk.blue(`📤 Team ${teamId} no longer monitored by any automations`));
  }
}

// MARK: - FigmaCommentEvent

export class FigmaCommentEvent extends InputEvent {
  readonly integrationType: IntegrationType = IntegrationType.FIGMA;
  data: FigmaCommentEventData;

  constructor(data: FigmaCommentEventData) {
    super();
    this.data = data;
  }

  formatForChannelAgent(): string {
    const indentMultiline = (text: string): string =>
      text
        .split('\n')
        .map((line) => `        ${line}`)
        .join('\n');

    let imageInfo = '';
    if (this.data.imageUrls) {
      const imageLines: string[] = [];
      if (this.data.imageUrls.nodeImage) {
        imageLines.push(`- Primary Node Image: ${this.data.imageUrls.nodeImage}`);
      }
      if (this.data.imageUrls.fullFrame) {
        imageLines.push(`- Full Frame Image: ${this.data.imageUrls.fullFrame}`);
      }
      if (imageLines.length > 0) {
        imageLines.push('- Note: Use these images to understand what element the comment refers to.');
        imageInfo = `Visual Context:\n${indentMultiline(imageLines.join('\n'))}`;
      }
    }

    const threadEntries = this.data.thread ? [...this.data.thread] : [];
    const currentThreadEntry = threadEntries.find((entry) => entry.id === this.data.commentId);
    const parentThreadEntry = currentThreadEntry?.parentId
      ? threadEntries.find((entry) => entry.id === currentThreadEntry.parentId)
      : undefined;
    const rootThreadEntry = threadEntries.find((entry) => entry.isRoot) ?? threadEntries[0];

    const formatThreadMessage = (entry: FigmaCommentThreadEntry): string => {
      const flags: string[] = [];
      if (entry.isRoot) {
        flags.push('root comment');
      }
      if (entry.id === this.data.commentId) {
        flags.push('current event');
      }
      if (entry.parentId && entry.parentId !== entry.id) {
        flags.push('reply');
      }
      if (entry.resolvedAt) {
        flags.push(`resolved on ${entry.resolvedAt}`);
      }

      const metadata = flags.length > 0 ? ` [${flags.join(' | ')}]` : '';
      const header = `${entry.author.handle} on ${entry.createdAt}${metadata}`;
      const messageBody = entry.message && entry.message.trim().length > 0
        ? entry.message.split('\n').map((line) => `  ${line}`).join('\n')
        : '  (no message)';

      return `${header}\n${messageBody}`;
    };

    const formatContextEntry = (entry: FigmaCommentThreadEntry): string => {
      const header = `${entry.author.handle} on ${entry.createdAt}`;
      const messageBody = entry.message && entry.message.trim().length > 0
        ? entry.message.split('\n').map((line) => `  ${line}`).join('\n')
        : '  (no message)';

      return `${header}\n${messageBody}`;
    };

    const messageBlock = this.data.message && this.data.message.trim().length > 0
      ? `Comment Message:\n${indentMultiline(this.data.message)}`
      : '';

    const directParentBlock = parentThreadEntry && parentThreadEntry.id !== this.data.commentId
      ? `Direct Parent Comment:\n${indentMultiline(formatContextEntry(parentThreadEntry))}`
      : '';

    const rootThreadBlock = rootThreadEntry
      && rootThreadEntry.id !== this.data.commentId
      && rootThreadEntry.id !== parentThreadEntry?.id
      ? `Thread Starting Comment:\n${indentMultiline(formatContextEntry(rootThreadEntry))}`
      : '';

    const threadInfo = threadEntries.length > 0
      ? `Full Comment Thread (oldest → newest):\n${indentMultiline(threadEntries.map((entry, index) => {
        const prefix = `${index + 1}. `;
        const formatted = formatThreadMessage(entry).split('\n');
        const withIndex = [formatted[0] ? `${prefix}${formatted[0]}` : prefix, ...formatted.slice(1)];
        return withIndex.join('\n');
      }).join('\n\n'))}`
      : '';

    const conversationContextSections = [
      messageBlock,
      directParentBlock,
      rootThreadBlock,
      threadInfo,
    ].filter((section) => section && section.trim().length > 0);

    const conversationContext = conversationContextSections.join('\n\n');

    const fileName = typeof this.data.fileMetadata?.name === 'string'
      ? this.data.fileMetadata.name
      : null;
    const folderName = typeof this.data.fileMetadata?.folder_name === 'string'
      ? this.data.fileMetadata.folder_name
      : null;

    const designContextLines: string[] = [];
    designContextLines.push(`Design File: ${fileName || 'Untitled Figma file'}`);
    if (folderName) {
      designContextLines.push(`Location: ${folderName}`);
    }
    designContextLines.push(`Open in Figma: ${this.data.fileUrl}`);

    const designContext = `Context:\n${indentMultiline(designContextLines.join('\n'))}`;

    const summarySection = [
      'Incoming Figma Comment Event',
      `Author: ${this.data.author.handle}`,
      `Created: ${this.data.createdAt}`,
      `Status: ${this.data.resolved ? 'Resolved' : 'Open'}`,
    ].join('\n');

    const sections = [
      summarySection,
      designContext,
      conversationContext,
      imageInfo,
    ].filter((section) => section && section.trim().length > 0);

    return `${sections.join('\n\n')}\n`;
  }

  debugLog(): string {
    return `Figma Comment Event: File ${this.data.fileKey} - ${this.data.author.handle} - ${this.data.message.substring(0, 50)}`;
  }

  matchesChannelInput(channelInput: ChannelInputWithConfigs): boolean {
    // Check if integration type matches
    if (channelInput.config_type !== InputConfigType.FIGMA) {
      return false;
    }

    // Require file_key to be configured and match the event's file_key
    const figmaConfig = channelInput.figma_config;
    if (!figmaConfig?.file_key) {
      // No file_key configured means this channel should not match any events
      return false;
    }

    // Event's file_key must match the channel input's file_key
    return this.data.fileKey === figmaConfig.file_key;
  }

  createTriggerMetadata(): RunHistoryTrigger {
    // Get file name from metadata, fall back to file key if not available
    const fileName = this.data.fileMetadata?.name || this.data.fileKey;
    const subheader = `${this.data.author.handle} on ${fileName}`;

    return {
      event: 'comment_added',
      integration: IntegrationType.FIGMA,
      source: this.data.fileKey,
      title: this.data.message.substring(0, 100), // First 100 chars of comment
      subheader: subheader,
      url: this.data.fileUrl,
    };
  }

  getImageUrls(): string[] {
    // Return all available image URLs from the Figma comment event
    const urls: string[] = [];
    if (this.data.imageUrls) {
      if (this.data.imageUrls.nodeImage) {
        urls.push(this.data.imageUrls.nodeImage);
      }
      if (this.data.imageUrls.fullFrame) {
        urls.push(this.data.imageUrls.fullFrame);
      }
    }
    return urls;
  }
}

// MARK: - Helper Functions

/**
 * Handle FILE_COMMENT webhook events
 * Comment data is included in the webhook payload
 * Note: client_meta is not included in webhook payload, so we fetch it from the comment API
 */
async function handleFigmaCommentEvent(
  integration: figma_integrations,
  webhookEvent: FigmaWebhookEvent,
  user: User,
) {
  // Extract comment_id from top level (Figma webhook structure)
  const commentId = webhookEvent.comment_id;
  const fileKey = webhookEvent.file_key;
  if (!commentId) {
    console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing comment_id`));
    console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
    return;
  }
  if (!fileKey) {
    console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing file_key`));
    console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
    return;
  }
  console.log(
    chalk.blue(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${commentId}`)
  );

  // Process the comment once per integration, to prevent duplicate processing
  try {
    await db().processed_figma_comments.create({
      data: {
        figma_integration_id: integration.id,
        comment_id: commentId,
        file_key: fileKey,
      },
    });
  } catch (error: any) {
    // Race condition - comment already being processed
    if (error.code === 'P2002') {
      console.log(chalk.blue(`ℹ️  Comment ${commentId} already being processed`));
      return;
    }
    throw error;
  }

  // Fetch comment details from Figma API to get client_meta
  // client_meta is not included in the webhook payload
  const commentThreadData = await fetchFigmaCommentThreadFromApi(
    integration.access_token,
    fileKey,
    commentId
  );
  if (!commentThreadData) {
    console.log(chalk.yellow(`⚠️  Could not fetch comment ${commentId} from API`));
    return;
  }

  const { comment: commentFromApi, thread } = commentThreadData;

  const { rootComment, positioningComment, positioningData } = resolvePositioningContext(
    commentFromApi,
    thread
  );

  console.log(
    chalk.blue(`Client Meta (event comment): ${JSON.stringify(commentFromApi.client_meta, null, 2)}`)
  );
  if (positioningComment && positioningComment.id !== commentFromApi.id) {
    console.log(
      chalk.blue(
        `Using comment ${positioningComment.id} client_meta for positioning: ${JSON.stringify(positioningComment.client_meta, null, 2)}`
      )
    );
  }
  console.log(
    chalk.blue(`📍 Positioning data for comment ${commentId}:`),
    positioningData ? JSON.stringify(positioningData, null, 2) : 'null (empty client_meta)'
  );

  // Map comment to design elements using positioning data
  let matchedNodeIds: string[] = [];
  try {
    const nodeId = positioningComment?.client_meta?.node_id ?? commentFromApi.client_meta?.node_id;
    matchedNodeIds = await mapCommentToDesignElements(
      integration.access_token,
      fileKey,
      positioningData,
      nodeId
    );
    console.log(
      chalk.blue(`🎯 Matched ${matchedNodeIds.length} node(s) for comment ${commentId}:`),
      matchedNodeIds.length > 0 ? matchedNodeIds.join(', ') : 'none'
    );
  } catch (error) {
    console.error(
      chalk.red(`Error mapping comment ${commentId} to design elements:`),
      error
    );
    // Continue with empty array if mapping fails
  }

  // Extract images for visual context
  let imageUrls: FigmaCommentImageUrls = {
    nodeImage: undefined,
    fullFrame: undefined,
  };
  try {
    imageUrls = await extractCommentImages(
      integration.access_token,
      fileKey,
      matchedNodeIds,
      positioningData
    );
    console.log(
      chalk.blue(`🖼️  Extracted images for comment ${commentId}:`),
      Object.keys(imageUrls).length > 0
        ? `${Object.keys(imageUrls).length} image(s) extracted`
        : 'no images extracted'
    );
  } catch (error) {
    console.error(
      chalk.red(`Error extracting images for comment ${commentId}:`),
      error
    );
    // Continue with empty object if image extraction fails
  }

  // Calculate image expiry (24 hours from now)
  const imageExpiry = imageUrls.nodeImage || imageUrls.fullFrame
    ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    : null;

  // Get the closest node ID for storage
  const closestNodeId = matchedNodeIds.length > 0
    ? matchedNodeIds[0]
    : (positioningComment?.client_meta?.node_id ?? commentFromApi.client_meta?.node_id ?? null);

  const fileMetadata = await fetchFileMetadata(integration.access_token, fileKey);
  if (!fileMetadata) {
    console.log(chalk.yellow(`⚠️  Could not fetch file metadata for file ${fileKey}`));
    return;
  }

  // Store enriched context for debugging
  try {
    await db().figma_comment_context.create({
      data: {
        figma_integration_id: integration.id,
        comment_id: commentId,
        file_key: fileKey,
        node_id: closestNodeId,
        comment_data: JSON.parse(JSON.stringify({
          ...commentFromApi,
          thread_comments: thread,
        })),
        file_metadata: fileMetadata ? JSON.parse(JSON.stringify(fileMetadata)) : null,
        positioning_data: positioningData ? JSON.parse(JSON.stringify(positioningData)) : null,
        matched_node_ids: matchedNodeIds,
        image_urls: Object.keys(imageUrls).length > 0 ? JSON.parse(JSON.stringify(imageUrls)) : null,
        image_expiry: imageExpiry,
      },
    });
    console.log(
      chalk.green(`✅ Stored enriched context for comment ${commentId}`),
      chalk.gray(`- Positioning: ${positioningData ? positioningData.type : 'none'}, Nodes: ${matchedNodeIds.length}, Images: ${Object.keys(imageUrls).length}`)
    );
  } catch (error) {
    console.error(
      chalk.red(`❌ Error storing enriched context for comment ${commentId}:`),
      error
    );
    // Don't throw - continue processing even if storage fails
  }

  const rootCommentId = rootComment?.id ?? commentFromApi.id;

  const threadEntries: FigmaCommentThreadEntry[] = thread.map((threadComment) => ({
    id: threadComment.id,
    message: threadComment.message,
    author: threadComment.user,
    createdAt: threadComment.created_at,
    resolvedAt: threadComment.resolved_at ?? null,
    parentId: threadComment.parent_id ?? null,
    orderId: threadComment.order_id,
    isRoot: threadComment.id === rootCommentId,
  }));

  const eventData: FigmaCommentEventData = {
    commentId: commentFromApi.id,
    fileKey: fileKey,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
    nodeId: closestNodeId || undefined,
    message: commentFromApi.message,
    author: commentFromApi.user,
    createdAt: commentFromApi.created_at,
    resolved: Boolean(commentFromApi.resolved_at && commentFromApi.resolved_at !== ''),
    thread: threadEntries,
    fileMetadata: fileMetadata,
    positioningData: positioningData ?? undefined,
    matchedNodeIds: matchedNodeIds.length > 0 ? matchedNodeIds : undefined,
    imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
  };
  const figmaEvent = new FigmaCommentEvent(eventData);
  const eventProcessor = new EventProcessor(figmaEvent, user);
  await eventProcessor.process();
}

/**
 * Get Figma access token for a user
 */
export async function getFigmaAccessToken(userId: string): Promise<string> {
  const figmaIntegration = await db().figma_integrations.findFirst({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!figmaIntegration) {
    throw new Error("Figma integration not found");
  }

  if (figmaIntegration.token_expiry && new Date() > figmaIntegration.token_expiry) {
    throw new Error("Figma access token has expired. Please re-authenticate.");
  }

  return figmaIntegration.access_token;
}

/**
 * Fetch file metadata for a file
 */
export async function fetchFileMetadata(
  accessToken: string,
  fileKey: string
): Promise<any> {
  try {
    // Using /v1/files/:key/meta endpoint which returns { file: { ... } }
    const metadataResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}/meta`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (metadataResponse.ok) {
      const metadataData = await metadataResponse.json();
      // Extract the file property from the response
      const fileMetadata = metadataData.file || metadataData;
      console.log(
        chalk.green(`✅ Fetched file metadata for ${fileKey}:`),
        fileMetadata?.name || 'unknown file'
      );
      return fileMetadata;
    } else {
      const errorText = await metadataResponse.text();
      console.error(
        chalk.yellow(`Failed to fetch file metadata for ${fileKey}:`),
        errorText
      );
      return null;
    }
  } catch (error) {
    console.error(chalk.red("Error fetching file metadata:"), error);
    return null;
  }
}

/**
 * Parse client_meta positioning data from Figma comment
 * Returns the positioning type and normalized data structure
 */
export function parsePositioningData(clientMeta: any): FigmaPositioningData | null {
  if (!clientMeta || typeof clientMeta !== 'object') {
    return null;
  }

  // Check for Vector: { x: number, y: number }
  if (typeof clientMeta.x === 'number' && typeof clientMeta.y === 'number' && !clientMeta.width && !clientMeta.height && !clientMeta.node_id) {
    return {
      type: 'Vector',
      data: { x: clientMeta.x, y: clientMeta.y }
    };
  }

  // Check for FrameOffset: { node_id: string, node_offset: { x: number, y: number } }
  if (clientMeta.node_id && clientMeta.node_offset && typeof clientMeta.node_offset.x === 'number' && typeof clientMeta.node_offset.y === 'number') {
    return {
      type: 'FrameOffset',
      data: {
        node_id: clientMeta.node_id,
        node_offset: { x: clientMeta.node_offset.x, y: clientMeta.node_offset.y }
      }
    };
  }

  // Check for Region: { x: number, y: number, width: number, height: number }
  if (typeof clientMeta.x === 'number' && typeof clientMeta.y === 'number' && typeof clientMeta.width === 'number' && typeof clientMeta.height === 'number' && !clientMeta.node_id) {
    return {
      type: 'Region',
      data: {
        x: clientMeta.x,
        y: clientMeta.y,
        width: clientMeta.width,
        height: clientMeta.height
      }
    };
  }

  // Check for FrameOffsetRegion: Combination of FrameOffset and Region
  if (clientMeta.node_id && clientMeta.node_offset && typeof clientMeta.x === 'number' && typeof clientMeta.y === 'number' && typeof clientMeta.width === 'number' && typeof clientMeta.height === 'number') {
    return {
      type: 'FrameOffsetRegion',
      data: {
        node_id: clientMeta.node_id,
        node_offset: clientMeta.node_offset,
        x: clientMeta.x,
        y: clientMeta.y,
        width: clientMeta.width,
        height: clientMeta.height
      }
    };
  }

  // Also check for node_id-only positioning (common case)
  if (clientMeta.node_id) {
    return {
      type: 'FrameOffset',
      data: {
        node_id: clientMeta.node_id,
        node_offset: clientMeta.node_offset || { x: 0, y: 0 }
      }
    };
  }

  return null;
}

/**
 * Map comment position to design elements in the file
 * Returns array of node IDs that match the comment position
 */
export async function mapCommentToDesignElements(
  accessToken: string,
  fileKey: string,
  positioningData: { type: string; data: any } | null,
  existingNodeId?: string
): Promise<string[]> {
  const matchedNodeIds: string[] = [];

  try {
    // If we already have a node_id from client_meta, use it
    if (existingNodeId) {
      matchedNodeIds.push(existingNodeId);
    }

    // If no positioning data, try to get root page/document nodes for file-level comments
    if (!positioningData) {
      // For file-level comments, try to get the document root or first page
      try {
        const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          const document = fileData.document;

          if (document) {
            // Get root page nodes (CANVAS type) or the document itself
            const findRootPages = (node: any, pages: string[] = []): void => {
              // CANVAS nodes are typically pages in Figma
              if (node.type === 'CANVAS' || node.type === 'FRAME') {
                pages.push(node.id);
              }
              // Limit to first 3 pages to avoid too many
              if (node.children && pages.length < 3) {
                for (const child of node.children) {
                  findRootPages(child, pages);
                }
              }
            };

            const rootPages: string[] = [];
            findRootPages(document, rootPages);

            // Add root pages to matched nodes for file-level comments
            for (const pageId of rootPages) {
              if (!matchedNodeIds.includes(pageId)) {
                matchedNodeIds.push(pageId);
              }
            }

            // If no pages found, use the document root itself
            if (matchedNodeIds.length === 0 && document.id) {
              matchedNodeIds.push(document.id);
            }
          }
        }
      } catch (error) {
        console.error(chalk.yellow(`Error fetching file for file-level comment context:`), error);
      }

      return matchedNodeIds;
    }

    // Fetch full file JSON to get all nodes and their positions
    const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!fileResponse.ok) {
      console.error(chalk.yellow(`Failed to fetch file JSON for ${fileKey}:`), await fileResponse.text());
      return matchedNodeIds; // Return existing node_id if we have it
    }

    const fileData = await fileResponse.json();
    const document = fileData.document;

    if (!document) {
      return matchedNodeIds;
    }

    // Helper function to recursively find all nodes with their bounds
    const findNodesWithBounds = (node: any, nodes: Array<{ id: string; bounds: any; name: string }> = []): void => {
      if (node.absoluteBoundingBox || node.relativeTransform) {
        const bounds = node.absoluteBoundingBox || {
          x: node.relativeTransform?.[0]?.[2] || 0,
          y: node.relativeTransform?.[1]?.[2] || 0,
          width: node.absoluteBoundingBox?.width || 0,
          height: node.absoluteBoundingBox?.height || 0,
        };

        nodes.push({
          id: node.id,
          bounds: bounds,
          name: node.name || 'Unnamed',
        });
      }

      if (node.children) {
        for (const child of node.children) {
          findNodesWithBounds(child, nodes);
        }
      }
    };

    const allNodes: Array<{ id: string; bounds: any; name: string }> = [];
    findNodesWithBounds(document, allNodes);

    // Match based on positioning type
    if (positioningData.type === 'Vector') {
      // For Vector, find nodes that contain the point
      const { x, y } = positioningData.data;
      for (const node of allNodes) {
        const bounds = node.bounds;
        if (bounds &&
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height) {
          if (!matchedNodeIds.includes(node.id)) {
            matchedNodeIds.push(node.id);
          }
        }
      }
    } else if (positioningData.type === 'Region') {
      // For Region, find nodes that overlap with the region
      const { x, y, width, height } = positioningData.data;
      const regionBounds = { x, y, width, height };

      for (const node of allNodes) {
        const bounds = node.bounds;
        if (bounds &&
          !(regionBounds.x + regionBounds.width < bounds.x ||
            regionBounds.x > bounds.x + regionBounds.width ||
            regionBounds.y + regionBounds.height < bounds.y ||
            regionBounds.y > bounds.y + bounds.height)) {
          // Overlaps
          if (!matchedNodeIds.includes(node.id)) {
            matchedNodeIds.push(node.id);
          }
        }
      }
    } else if (positioningData.type === 'FrameOffset' || positioningData.type === 'FrameOffsetRegion') {
      // For FrameOffset, the node_id is already in the data
      const nodeId = positioningData.data.node_id;
      if (nodeId && !matchedNodeIds.includes(nodeId)) {
        matchedNodeIds.push(nodeId);
      }

      // For FrameOffsetRegion, also check region overlap
      if (positioningData.type === 'FrameOffsetRegion' && positioningData.data.x !== undefined) {
        const { x, y, width, height } = positioningData.data;
        const regionBounds = { x, y, width, height };

        for (const node of allNodes) {
          const bounds = node.bounds;
          if (bounds &&
            !(regionBounds.x + regionBounds.width < bounds.x ||
              regionBounds.x > bounds.x + bounds.width ||
              regionBounds.y + regionBounds.height < bounds.y ||
              regionBounds.y > bounds.y + bounds.height)) {
            if (!matchedNodeIds.includes(node.id)) {
              matchedNodeIds.push(node.id);
            }
          }
        }
      }
    }

    // Sort by specificity (smaller nodes first, as they're more specific)
    matchedNodeIds.sort((id1, id2) => {
      const node1 = allNodes.find(n => n.id === id1);
      const node2 = allNodes.find(n => n.id === id2);
      if (!node1 || !node2) return 0;
      const area1 = (node1.bounds?.width || 0) * (node1.bounds?.height || 0);
      const area2 = (node2.bounds?.width || 0) * (node2.bounds?.height || 0);
      return area1 - area2;
    });

  } catch (error) {
    console.error(chalk.red("Error mapping comment to design elements:"), error);
    // Return existing node_id if we have it, even if mapping failed
  }

  return matchedNodeIds;
}

/**
 * Extract images for comment context from Figma API
 * Returns object with image URLs for different context levels
 */
export async function extractCommentImages(
  accessToken: string,
  fileKey: string,
  nodeIds: string[],
  positioningData: { type: string; data: any } | null
): Promise<FigmaCommentImageUrls> {
  const imageUrls: FigmaCommentImageUrls = {};

  try {
    if (nodeIds.length === 0) {
      // No nodes to extract - might be file-level comment
      // For file-level comments, try to extract the first page/document
      if (!positioningData) {
        // Try to get document root or first page
        try {
          const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          });

          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            const document = fileData.document;

            if (document) {
              // Find first CANVAS (page) or use document root
              let pageNodeId: string | null = null;

              const findFirstPage = (node: any): void => {
                if (node.type === 'CANVAS' || (node.type === 'FRAME' && !pageNodeId)) {
                  pageNodeId = node.id;
                }
                if (!pageNodeId && node.children) {
                  for (const child of node.children) {
                    findFirstPage(child);
                    if (pageNodeId) break;
                  }
                }
              };

              findFirstPage(document);

              const targetNodeId = pageNodeId || document.id;

              if (targetNodeId) {
                const imageResponse = await fetch(
                  `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetNodeId)}&format=png&scale=1`,
                  {
                    method: "GET",
                    headers: {
                      "Authorization": `Bearer ${accessToken}`,
                    },
                  }
                );

                if (imageResponse.ok) {
                  const imageData = await imageResponse.json();
                  if (imageData.images && imageData.images[targetNodeId]) {
                    imageUrls.fullFrame = imageData.images[targetNodeId];
                    console.log(chalk.blue(`📄 Extracted full page image for file-level comment`));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(chalk.yellow(`Error extracting file-level comment image:`), error);
        }
      }
      return imageUrls;
    }

    // Primary node image - the specific node the comment is on
    const primaryNodeId = nodeIds[0];
    if (primaryNodeId) {
      const imageResponse = await fetch(
        `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(primaryNodeId)}&format=png&scale=2`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        if (imageData.images && imageData.images[primaryNodeId]) {
          imageUrls.nodeImage = imageData.images[primaryNodeId];
        }
      } else {
        console.error(chalk.yellow(`Failed to extract node image for ${primaryNodeId}:`), await imageResponse.text());
      }
    }

    // Full frame image - extract the page/frame containing the comment
    // Find the page (CANVAS) that contains the primary node
    try {
      const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        const document = fileData.document;

        if (document && primaryNodeId) {
          // Find the page (CANVAS) that contains the primary node
          let pageNodeId: string | null = null;

          const findPageForNode = (node: any, targetId: string): void => {
            if (node.type === 'CANVAS') {
              // Check if this page contains the target node
              const containsNode = (n: any): boolean => {
                if (n.id === targetId) return true;
                if (n.children) {
                  return n.children.some((child: any) => containsNode(child));
                }
                return false;
              };

              if (containsNode(node)) {
                pageNodeId = node.id;
                return;
              }
            }

            if (node.children && !pageNodeId) {
              for (const child of node.children) {
                findPageForNode(child, targetId);
                if (pageNodeId) break;
              }
            }
          };

          findPageForNode(document, primaryNodeId);

          const targetFrameId = pageNodeId || primaryNodeId;

          if (targetFrameId) {
            const fullFrameResponse = await fetch(
              `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetFrameId)}&format=png&scale=1`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                },
              }
            );

            if (fullFrameResponse.ok) {
              const fullFrameData = await fullFrameResponse.json();
              if (fullFrameData.images && fullFrameData.images[targetFrameId]) {
                imageUrls.fullFrame = fullFrameData.images[targetFrameId];
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(chalk.yellow(`Error extracting full frame image:`), error);
      // Continue without full frame image
    }

  } catch (error) {
    console.error(chalk.red("Error extracting comment images:"), error);
    // Don't throw - image extraction is optional, continue without images
  }

  return imageUrls;
}


/**
 * Fetch comment from Figma API using a single integration
 */
export async function fetchFigmaCommentThreadFromApi(
  accessToken: string,
  fileKey: string,
  commentId: string
): Promise<{ comment: FigmaApiComment; thread: FigmaApiComment[] } | null> {
  try {
    const commentsResponse = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/comments`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!commentsResponse.ok) {
      console.error(
        chalk.yellow(`Failed to fetch comments for file ${fileKey}`),
        await commentsResponse.text()
      );
      return null;
    }

    const commentsData = await commentsResponse.json();
    const comments = (commentsData.comments || []) as FigmaApiComment[];

    if (!Array.isArray(comments) || comments.length === 0) {
      return null;
    }

    const commentMap = new Map<string, FigmaApiComment>();
    for (const rawComment of comments) {
      commentMap.set(rawComment.id, rawComment);
    }

    const targetComment = commentMap.get(commentId);

    if (!targetComment) {
      return null;
    }

    const findRootComment = (comment: FigmaApiComment): FigmaApiComment => {
      let current: FigmaApiComment = comment;
      const visited = new Set<string>();

      while (current.parent_id) {
        if (visited.has(current.parent_id)) {
          break;
        }

        visited.add(current.parent_id);
        const parent = commentMap.get(current.parent_id);
        if (!parent) {
          break;
        }
        current = parent;
      }

      return current;
    };

    const rootComment = findRootComment(targetComment);
    const rootOrderId = rootComment.order_id || rootComment.id;

    const threadComments = comments
      .filter((comment) => {
        if (comment.id === rootComment.id) {
          return true;
        }

        // Prefer order_id when available (covers replies and nested replies)
        if (rootOrderId && comment.order_id) {
          return comment.order_id === rootOrderId;
        }

        // Fallback: walk up the parent chain to see if it reaches the root comment
        let current: FigmaApiComment | undefined = comment;
        const visited = new Set<string>();
        while (current?.parent_id) {
          if (visited.has(current.parent_id)) {
            break;
          }
          visited.add(current.parent_id);

          if (current.parent_id === rootComment.id) {
            return true;
          }

          current = commentMap.get(current.parent_id);
        }

        return false;
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return aTime - bTime;
      });

    const threadList = threadComments.length > 0 ? threadComments : [targetComment];

    return {
      comment: targetComment,
      thread: threadList,
    };
  } catch (error) {
    console.error(
      chalk.yellow(`⚠️  Error fetching comment from API with file key ${fileKey}`),
      error
    );
    return null;
  }
}

export function findRootThreadComment(
  thread: FigmaApiComment[],
  fallback: FigmaApiComment
): FigmaApiComment {
  if (thread.length === 0) {
    return fallback;
  }

  const explicitRoot = thread.find((comment) => !comment.parent_id);
  if (explicitRoot) {
    return explicitRoot;
  }

  return thread[0] ?? fallback;
}

export function resolvePositioningContext(
  targetComment: FigmaApiComment,
  thread: FigmaApiComment[]
): {
  rootComment: FigmaApiComment;
  positioningComment: FigmaApiComment;
  positioningData: FigmaPositioningData | null;
} {
  const rootComment = findRootThreadComment(thread, targetComment);

  const orderedCandidates = [targetComment, ...thread.filter((comment) => comment.id !== targetComment.id)];
  const candidateWithMeta = orderedCandidates.find((comment) => comment.client_meta);
  const positioningComment = candidateWithMeta ?? (rootComment.client_meta ? rootComment : targetComment);

  const positioningData = parsePositioningData(positioningComment?.client_meta ?? null);

  return {
    rootComment,
    positioningComment,
    positioningData,
  };
}

// MARK: - Types

/**
 * Figma webhook comment text object (from webhook payload)
 */
export interface FigmaWebhookCommentText {
  text: string;
}

/**
 * Raw Figma webhook event payload
 * Generated from actual Figma webhook payload structure
 */
export interface FigmaWebhookEvent {
  event_type: string;
  file_key: string;
  file_name: string;
  passcode: string;
  protocol_version: string;
  webhook_id: string;
  timestamp: string;
  retries: number;
  // FILE_COMMENT specific fields
  comment_id: string;
  comment: FigmaWebhookCommentText[];
  created_at: string;
  resolved_at: string; // Empty string if not resolved
  parent_id: string; // Empty string if no parent
  order_id: string;
  mentions: unknown[]; // Array of mention objects (structure unknown)
  triggered_by: FigmaWebhookUser;
}

