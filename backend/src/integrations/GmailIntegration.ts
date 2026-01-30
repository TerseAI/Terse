import { InputConfigType } from "@prisma/client";
import crypto from "crypto";
import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { gmail_v1, google } from "googleapis";
import { EventProcessor } from "../agent/AgentRunner/EventProcessor";
import {
  gmail as gmailConfig,
  OAUTH_TOKEN_REFRESH_THRESHOLD_MS,
  urls,
} from "../config/settings";
import logger, { runWithUserContext } from "../logger";
import { db } from "../prismaClient";
import {
  buildGmailFileKey,
  ensureStoredWithMetadata,
  FileDownloadResult,
  isSupportedFileType,
  StoredFile,
} from "../services/FileStorageService";
import { FrontendRoutes } from "../shared/FrontendRoutes";
import {
  AdditionalStateParams,
  GmailIntegration,
  GmailIntegrationMetadata,
  InstallationOptionsFor,
  IntegrationType,
} from "../shared/Integrations";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { OAuthInstallationDetails } from "../shared/types";
import {
  AgentTriggerWithConfigs,
  GmailIntegration as PrismaGmailIntegration,
  User,
} from "../types/prisma";
import {
  createOAuthStateToken,
  decodeOAuthStateToken,
  OAuthStateEncodingFormat,
} from "../utility/oauth";
import { InputEvent } from "./abstract/InputEvent";
import {
  ConfigurationFieldDefinition,
  Integration,
  OAuthIntegrationInstallation,
} from "./abstract/Integration";
import { IntegrationCompletedTask } from "./IntegrationCompletedTask";
import { integrationTaskQueue } from "./IntegrationTaskQueues";

// OAuth2 scopes for Gmail
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export class GmailIntegrationManager
  implements
    Integration<
      GmailIntegration,
      GmailWebhookEvent,
      typeof GmailIntegrationMetadata
    >,
    OAuthIntegrationInstallation<IntegrationType.GMAIL>
{
  constructor() {}
  integrationType: IntegrationType = IntegrationType.GMAIL;

  getConfigurationFields(): ConfigurationFieldDefinition[] {
    return [];
  }

  async getInstancesForUser(userId: string): Promise<GmailIntegration[]> {
    const prisma = db();
    const integrations = await prisma.gmail_integrations.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        history_id: true,
        watch_expiration: true,
      },
    });
    return integrations.map((gi) => ({
      id: gi.id,
      email: gi.email,
      historyId: gi.history_id,
      watchExpiration: gi.watch_expiration,
    }));
  }

  formatIntegrationInstanceForAgent(instance: GmailIntegration): string {
    const details: string[] = [];
    if (instance.email) {
      details.push(`email ${instance.email}`);
    }
    const detailText = details.length ? ` (${details.join(", ")})` : "";
    return `Gmail${detailText} [id: ${instance.id}]`;
  }

  async getAllActiveInstances(): Promise<GmailIntegration[]> {
    const integrations = await db().gmail_integrations.findMany({
      where: { is_active: true },
      select: {
        id: true,
        email: true,
        history_id: true,
        watch_expiration: true,
      },
    });
    return integrations.map((gi) => ({
      id: gi.id,
      email: gi.email,
      historyId: gi.history_id,
      watchExpiration: gi.watch_expiration,
    }));
  }

  async processWebhookEvent(event: GmailWebhookEvent): Promise<void> {
    const { emailAddress, historyId } = event;
    logger.info(
      `Gmail notification for ${emailAddress}, historyId: ${historyId}`,
      { emailAddress, historyId },
    );

    try {
      // Step 1: Atomically claim this history ID update (CRITICAL SECTION - in transaction)
      const claims = await db().$transaction(async (tx) => {
        return await claimHistoryIdUpdateInTransaction(
          tx,
          emailAddress,
          historyId,
        );
      });

      if (claims.length === 0) {
        logger.debug(`Skipping webhook processing for ${emailAddress}`, {
          emailAddress,
          historyId,
        });
        return;
      }

      for (const claim of claims) {
        if (!claim.shouldProcess) {
          continue;
        }
        const { integration, user, oldHistoryId } = claim;

        // Process with user context for logging
        await runWithUserContext(user.id, user.email, async () => {
          // Step 2: Fetch message IDs from Gmail (fast, non-blocking)
          const messageIds = await fetchNewMessageIds(
            integration,
            oldHistoryId,
          );

          if (messageIds.length === 0) {
            logger.debug(`No new messages to process for ${emailAddress}`, {
              emailAddress,
              integrationId: integration.id,
            });
            return;
          }

          // Step 3: Set up Gmail client (fast, non-blocking)
          const accessToken = await refreshAccessTokenIfNeeded(integration);
          const oauth2Client = getOAuth2Client();
          oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: integration.refresh_token,
          });
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          const lastProcessedDate: Date | null =
            integration.last_processed_message_date;
          let mostRecentEmailDate: Date | null = lastProcessedDate;

          // Step 4: Process each message (fast, non-blocking)
          for (const messageId of messageIds) {
            // Try to mark this message as processed (non-blocking, unique constraint prevents duplicates)
            const wasNewlyProcessed = await markMessageAsProcessed(
              integration.id,
              messageId,
              String(Date.now()),
            );

            if (!wasNewlyProcessed) {
              logger.debug(`Skipping already processed message ${messageId}`, {
                messageId,
                integrationId: integration.id,
              });
              continue;
            }

            const parsedEmail: GmailEventData | null = await fetchAndParseEmail(
              gmail,
              messageId,
            );

            if (parsedEmail) {
              const emailTimestamp = parseInt(parsedEmail.internalDate, 10);
              const emailDate = new Date(emailTimestamp);

              logger.debug("Received Webhook for email", {
                from: parsedEmail.from,
                to: parsedEmail.to,
                subject: parsedEmail.subject,
                date: emailDate.toISOString(),
                messageId,
                integrationId: integration.id,
              });

              // Skip messages older than the last processed message date
              if (lastProcessedDate && emailDate <= lastProcessedDate) {
                logger.debug(
                  `Skipping old message ${
                    parsedEmail.id
                  } from ${emailDate.toISOString()}`,
                  {
                    messageId: parsedEmail.id,
                    subject: parsedEmail.subject,
                    emailDate: emailDate.toISOString(),
                    lastProcessedDate: lastProcessedDate.toISOString(),
                    integrationId: integration.id,
                  },
                );
                // Mark as processed (non-blocking)
                await markMessageAsProcessed(
                  integration.id,
                  parsedEmail.id,
                  parsedEmail.internalDate,
                );
                continue;
              }

              // Download attachments and store in GCS (if configured)
              // Support: images, PDFs, documents, spreadsheets
              const allAttachments = parsedEmail.attachments || [];
              if (allAttachments.length > 0) {
                const storedFiles = await downloadGmailAttachments(
                  gmail,
                  parsedEmail.id,
                  allAttachments,
                  integration.id,
                );
                if (storedFiles.length > 0) {
                  parsedEmail.storedFiles = storedFiles;
                }
              }

              // Process email through automations (non-blocking)
              logger.info("About to process email", {
                userEmail: user.email,
                subject: parsedEmail.subject,
                from: parsedEmail.from,
                to: parsedEmail.to,
                date: emailDate.toISOString(),
                integrationId: integration.id,
                messageId: parsedEmail.id,
                fileCount: parsedEmail.storedFiles?.length || 0,
              });

              const eventProcessor = new EventProcessor(
                new GmailEvent(parsedEmail, integration.id),
                user,
              );
              const results = await eventProcessor.process();

              // Process results from all automations
              let hasSuccess = false;
              for (const result of results) {
                if (result.success) {
                  logger.info(
                    `Email processed successfully by agent: ${
                      result.agentConfig?.name || "unknown"
                    }`,
                    {
                      agentName: result.agentConfig?.name,
                      integrationId: integration.id,
                      messageId: parsedEmail.id,
                    },
                  );
                  hasSuccess = true;
                } else {
                  logger.debug(
                    `Agent "${
                      result.agentConfig?.name || "unknown"
                    }" skipped: ${result.message}`,
                    {
                      agentName: result.agentConfig?.name,
                      message: result.message,
                      integrationId: integration.id,
                    },
                  );
                }
              }

              // Track the most recent email date if processing succeeded
              if (
                hasSuccess &&
                (!mostRecentEmailDate || emailDate > mostRecentEmailDate)
              ) {
                mostRecentEmailDate = emailDate;
              }
            }
          }

          // Step 5: Update the last processed message date (non-blocking)
          if (
            mostRecentEmailDate &&
            mostRecentEmailDate !== lastProcessedDate
          ) {
            await db().gmail_integrations.update({
              where: { id: integration.id },
              data: { last_processed_message_date: mostRecentEmailDate },
            });
            logger.info(
              `Updated last processed message date to ${mostRecentEmailDate.toISOString()}`,
              {
                mostRecentEmailDate: mostRecentEmailDate.toISOString(),
                integrationId: integration.id,
              },
            );
          }

          logger.info(
            `Successfully processed webhook for ${emailAddress}, historyId: ${historyId}`,
            { emailAddress, historyId, integrationId: integration.id },
          );
        });
      }
    } catch (error) {
      logger.error("Error processing Gmail webhook", {
        error,
        emailAddress,
        historyId,
      });
      // Re-throw to ensure it's logged by the caller
      throw error;
    }
  }

  async getInstallationUrl(
    userId: string,
    options?: InstallationOptionsFor<IntegrationType.GMAIL>,
    additionalStatePayload?: AdditionalStateParams,
  ): Promise<OAuthInstallationDetails> {
    const oauth2Client = getOAuth2Client();

    // Generate state token using helper function (handles merging and encoding)
    // Include random for CSRF protection
    const state = createOAuthStateToken({
      userId,
      additionalFields: {
        random: crypto.randomBytes(16).toString("hex"),
      },
      additionalStatePayload,
      encodingFormat: OAuthStateEncodingFormat.BASE64,
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Get refresh token
      scope: SCOPES,
      state: state,
      prompt: "consent", // Force consent screen to get refresh token
    });
    return {
      oauthUrl: authUrl,
    };
  }

  async processInstallationCallback(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { code, state } = req.query as { code?: string; state?: string };

    logger.debug("Gmail OAuth callback received");

    if (!code || !state) {
      res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
      return;
    }

    try {
      // Decode state using helper function
      const stateData = decodeOAuthStateToken(state);
      const userId = stateData.userId;

      if (!userId) {
        res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
        return;
      }

      const oauth2Client = getOAuth2Client();

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      if (!tokens.access_token || !tokens.refresh_token) {
        res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
        return;
      }

      // Get user's email address
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const emailAddress = profile.data.emailAddress;

      if (!emailAddress) {
        res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
        return;
      }

      // Set up Gmail watch
      const watchResponse = await gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName: gmailConfig.pubsubTopic,
          labelIds: ["INBOX"],
          labelFilterAction: "include",
        },
      });

      const historyId = watchResponse.data.historyId;
      const expiration = watchResponse.data.expiration;

      if (!historyId || !expiration) {
        res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
        return;
      }

      // Calculate token expiry
      const tokenExpiry = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000); // Default 1 hour

      // Store in database and set is_active to true
      const integration = await db().gmail_integrations.upsert({
        where: {
          user_id_email: {
            user_id: userId,
            email: emailAddress,
          },
        },
        create: {
          user_id: userId,
          email: emailAddress,
          history_id: historyId,
          watch_expiration: new Date(parseInt(expiration)),
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          is_active: true,
          last_processed_message_date: new Date(), // Set initial date to prevent processing historical messages
        },
        update: {
          history_id: historyId,
          watch_expiration: new Date(parseInt(expiration)),
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          is_active: true, // Reactivate if it was previously disabled
          // Don't reset last_processed_message_date on reactivation - preserve existing value
        },
      });

      logger.info(`Gmail integration activated for ${emailAddress}`, {
        emailAddress,
        userId,
      });

      // Emit integration completed task (includes full state payload for chat metadata detection)
      integrationTaskQueue.emit(
        new IntegrationCompletedTask(
          IntegrationType.GMAIL,
          integration.id,
          userId,
          stateData,
          new Date(),
        ),
      );

      // Redirect to success page which will auto-close the popup
      res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`);
    } catch (error) {
      logger.error("Gmail OAuth error", { error });
      res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
    }
  }

  deleteInstallation(integrationId: string): Promise<void> {
    return Promise.resolve();
  }

  async setupAgentTrigger(
    integrationId: string,
    agentTrigger: AgentTriggerWithConfigs,
  ): Promise<void> {
    // Gmail doesn't require any setup for channel inputs
    // Webhooks are managed at the integration level
  }

  async teardownAgentTrigger(
    integrationId: string,
    agentTrigger: AgentTriggerWithConfigs,
  ): Promise<void> {
    // Gmail doesn't require any teardown for channel inputs
    // Webhooks are managed at the integration level
  }

  async refreshToken(integrationId: string): Promise<boolean> {
    try {
      const integration = await db().gmail_integrations.findUnique({
        where: { id: integrationId },
      });

      if (!integration || !integration.is_active) {
        logger.warn(
          `Gmail integration ${integrationId} not found or inactive`,
          { integrationId },
        );
        return false;
      }

      // Store the original token expiry to detect if refresh happened
      const originalTokenExpiry = integration.token_expiry;

      // Use getAccessToken which internally handles token refresh via refreshAccessTokenIfNeeded
      const accessToken = await this.getAccessToken(integrationId);
      if (!accessToken) {
        logger.error(
          `Failed to get access token for Gmail integration ${integrationId}`,
          { integrationId },
        );
        return false;
      }

      // Check if token was refreshed by comparing expiry dates
      const updatedIntegration = await db().gmail_integrations.findUnique({
        where: { id: integrationId },
        select: { token_expiry: true, refresh_token: true },
      });

      const tokenRefreshed =
        updatedIntegration &&
        originalTokenExpiry &&
        updatedIntegration.token_expiry
          ? updatedIntegration.token_expiry.getTime() !==
            originalTokenExpiry.getTime()
          : false;

      // Also refresh the Gmail watch if it's expiring soon (within 24 hours) or if token was refreshed
      const now = new Date();
      const watchNeedsRefresh =
        !integration.watch_expiration ||
        integration.watch_expiration <=
          new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (watchNeedsRefresh || tokenRefreshed) {
        logger.info(`Refreshing Gmail watch for integration ${integrationId}`, {
          integrationId,
          watchNeedsRefresh,
          tokenRefreshed,
        });

        // Set up OAuth client with current credentials
        const oauth2Client = getOAuth2Client();
        const currentExpiry =
          updatedIntegration?.token_expiry || integration.token_expiry;
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token:
            updatedIntegration?.refresh_token || integration.refresh_token,
          expiry_date: currentExpiry?.getTime(),
        });

        // Get Gmail client
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // Refresh the watch
        const watchResponse = await gmail.users.watch({
          userId: "me",
          requestBody: {
            topicName: gmailConfig.pubsubTopic,
            labelIds: ["INBOX"],
            labelFilterAction: "include",
          },
        });

        const historyId = watchResponse.data.historyId;
        const expiration = watchResponse.data.expiration;

        if (!historyId || !expiration) {
          logger.error(
            `Failed to refresh watch for ${integrationId}: Missing historyId or expiration`,
            { integrationId },
          );
          // Don't fail the whole operation if watch refresh fails
        } else {
          // Update the database with new watch information
          await db().gmail_integrations.update({
            where: { id: integration.id },
            data: {
              history_id: historyId,
              watch_expiration: new Date(parseInt(expiration)),
            },
          });

          logger.info(
            `Successfully refreshed Gmail watch for ${integrationId}. New expiration: ${new Date(
              parseInt(expiration),
            ).toISOString()}`,
            {
              integrationId,
              expiration: new Date(parseInt(expiration)).toISOString(),
            },
          );
        }
      }

      return tokenRefreshed;
    } catch (error) {
      logger.error(
        `Error refreshing Gmail token for integration ${integrationId}`,
        { error, integrationId },
      );
      return false;
    }
  }

  async getAccessToken(integrationId: string): Promise<string | null> {
    try {
      const integration = await db().gmail_integrations.findUnique({
        where: { id: integrationId },
      });

      if (!integration || !integration.is_active) {
        logger.error(
          `Gmail integration ${integrationId} not found or inactive`,
          { integrationId },
        );
        return null;
      }

      // Use the existing helper function to ensure token is refreshed if needed
      return await refreshAccessTokenIfNeeded(integration);
    } catch (error) {
      logger.error(
        `Error getting Gmail access token for integration ${integrationId}`,
        { error, integrationId },
      );
      return null;
    }
  }
}

export class GmailEvent extends InputEvent {
  readonly integrationType: IntegrationType = IntegrationType.GMAIL;
  data: GmailEventData;
  private integrationId: string;

  constructor(data: GmailEventData, integrationId: string) {
    super();
    this.data = data;
    this.integrationId = integrationId;
  }

  formatForAgentRunner(): string {
    const getAttachmentLog = (attachment: GmailParsedAttachment) => {
      return `- ${attachment.filename} ${
        attachment.isInline ? "Inline" : "Attachment"
      }  (${attachment.mimeType})`;
    };
    const attachmentInfo =
      this.data.attachments?.map(getAttachmentLog).join("\n") ||
      "No attachments";

    return `
        Incoming Email Event.

        Gmail Event:
        Subject: ${this.data.subject}
        From: ${this.data.from}
        To: ${this.data.to}
        Date: ${this.data.date}
        Message ID: ${this.data.messageId}
        Thread ID: ${this.data.threadId}
        Body: ${this.data.body}
        Snippet: ${this.data.snippet}
        Attachments (if any listed, actual files should be added below):
        ${attachmentInfo}
        `;
  }

  debugLog(): string {
    return `Gmail Event: ${this.data.subject} message ID: ${this.data.messageId}`;
  }

  matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
    // Check if integration type matches
    if (agentTrigger.config_type !== InputConfigType.GMAIL) {
      return false;
    }

    // If the event is not in the INBOX, it doesn't match the channel input
    if (!this.data.labelIds.includes("INBOX")) {
      logger.debug(
        `Skipping email ${this.data.messageId} because it is not in the INBOX with label ids: ${this.data.labelIds}`,
        { messageId: this.data.messageId, labelIds: this.data.labelIds },
      );
      return false;
    }

    // If integrationId is set, it must match the automation's integration_id
    // This ensures automations are only triggered by emails from their configured integration
    if (
      this.integrationId &&
      agentTrigger.integration_id !== this.integrationId
    ) {
      logger.debug(
        `Skipping email ${this.data.messageId} - integration ID mismatch: event from ${this.integrationId}, channel expects ${agentTrigger.integration_id}`,
        {
          messageId: this.data.messageId,
          eventIntegrationId: this.integrationId,
          channelIntegrationId: agentTrigger.integration_id,
        },
      );
      return false;
    }

    return true;
  }

  createTriggerMetadata(): RunHistoryTrigger {
    // Construct Gmail message URL using the thread ID with #all
    // Format: https://mail.google.com/mail/u/0/#all/{threadId}
    // Using #all instead of #inbox ensures the link works regardless of label
    const gmailUrl = this.data.threadId
      ? `https://mail.google.com/mail/u/0/#all/${this.data.threadId}`
      : undefined;

    return {
      event: "email_received",
      integration: IntegrationType.GMAIL,
      source: this.data.to || "Gmail",
      title: this.data.subject,
      subheader: this.data.from,
      url: gmailUrl,
    };
  }

  getFiles(): StoredFile[] {
    // Return all stored files with full metadata
    return this.data.storedFiles || [];
  }
}

// Create OAuth2 client
export function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    gmailConfig.clientId,
    gmailConfig.clientSecret,
    gmailConfig.redirectUri,
  );
}

/**
 * Refresh access token if expired
 */
async function refreshAccessTokenIfNeeded(
  integration: PrismaGmailIntegration,
): Promise<string> {
  const now = new Date();

  // Check if token is expired or will expire within the refresh threshold
  if (
    integration.token_expiry &&
    integration.token_expiry <=
      new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)
  ) {
    logger.info("Access token expired or expiring soon, refreshing...", {
      integrationId: integration.id,
      tokenExpiry: integration.token_expiry,
    });

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: integration.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const newTokenExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Update the database with new tokens
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: {
        access_token: credentials.access_token!,
        token_expiry: newTokenExpiry,
      },
    });

    logger.info("Access token refreshed successfully", {
      integrationId: integration.id,
      newTokenExpiry,
    });

    return credentials.access_token!;
  }

  return integration.access_token;
}

/**
 * Atomically claim a history ID update within an existing transaction
 * Returns null if the webhook should be skipped (already processed or no integration)
 */
async function claimHistoryIdUpdateInTransaction(
  tx: any,
  emailAddress: string, // This is the email belonging to the gmail watch webhook
  newHistoryId: number,
): Promise<ProcessedWebhookClaim[]> {
  const newHistoryIdString = newHistoryId.toString();

  logger.debug("Getting Integrations associated with email", {
    emailAddress,
    newHistoryId: newHistoryIdString,
  });
  const integrations = await tx.gmail_integrations.findMany({
    where: {
      email: emailAddress,
      is_active: true,
    },
  });

  if (!integrations || integrations.length === 0) {
    logger.debug("No active integrations found for email", { emailAddress });
    return [
      {
        shouldProcess: false,
        integration: null,
        user: null,
        oldHistoryId: null,
      },
    ];
  }

  const claims: ProcessedWebhookClaim[] = await Promise.all(
    integrations.map(async (integration: PrismaGmailIntegration) => {
      const oldHistoryId = integration.history_id;
      const currentHistoryId = parseInt(integration.history_id, 10);
      if (newHistoryId <= currentHistoryId) {
        logger.debug(
          `Skipping webhook: historyId ${newHistoryId} is not newer than current ${currentHistoryId}`,
          { newHistoryId, currentHistoryId, integrationId: integration.id },
        );
        return {
          shouldProcess: false,
          integration: null,
          user: null,
          oldHistoryId: null,
        };
      }

      // Atomically update the history ID to claim this batch
      // This prevents other concurrent webhooks from processing the same messages
      const updatedIntegration = await tx.gmail_integrations.update({
        where: { id: integration.id },
        data: { history_id: newHistoryIdString },
      });

      const user = await tx.users.findUnique({
        where: {
          id: integration.user_id,
        },
      });

      if (!user) {
        logger.warn("No user found for integration", {
          userId: integration.user_id,
          integrationId: integration.id,
        });
        return {
          shouldProcess: false,
          integration: null,
          user: null,
          oldHistoryId: null,
        };
      }

      return {
        shouldProcess: true,
        integration: updatedIntegration,
        user: user,
        oldHistoryId: oldHistoryId,
      };
    }),
  );
  return claims;
}

/**
 * Mark a message as processed in the database
 * Returns true if the message was newly marked, false if it was already processed
 * Uses unique constraint to prevent duplicates (fast, non-blocking)
 */
async function markMessageAsProcessed(
  integrationId: string,
  messageId: string,
  internalDate: string,
): Promise<boolean> {
  try {
    await db().processed_gmail_messages.create({
      data: {
        gmail_integration_id: integrationId,
        gmail_message_id: messageId,
        internal_date: internalDate,
      },
    });
    return true;
  } catch (error: any) {
    // If unique constraint fails, this message was already processed
    if (error.code === "P2002") {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Fetch new message IDs from Gmail history
 */
async function fetchNewMessageIds(
  integration: PrismaGmailIntegration,
  oldHistoryId: string,
): Promise<string[]> {
  // Refresh token if needed
  const accessToken = await refreshAccessTokenIfNeeded(integration);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: integration.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  logger.debug(`Fetching Gmail history from ${oldHistoryId}`, {
    oldHistoryId,
    integrationId: integration.id,
  });

  const historyResponse = await gmail.users.history.list({
    userId: "me",
    startHistoryId: oldHistoryId,
    historyTypes: ["messageAdded"],
    labelId: "INBOX",
  });

  const history = historyResponse.data.history || [];

  if (history.length === 0) {
    logger.debug("No new messages in history", {
      oldHistoryId,
      integrationId: integration.id,
    });
    return [];
  }

  // Extract message IDs from history
  const messageIds: string[] = [];
  for (const record of history) {
    if (record.messagesAdded) {
      for (const added of record.messagesAdded) {
        if (added.message?.id) {
          messageIds.push(added.message.id);
        }
      }
    }
  }

  logger.debug(`Found ${messageIds.length} new messages`, {
    messageCount: messageIds.length,
    oldHistoryId,
    integrationId: integration.id,
  });

  return messageIds;
}

async function fetchAndParseEmail(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<GmailEventData | null> {
  const messageResponse = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const message = messageResponse.data;
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase(),
    );
    return header?.value || "";
  };

  const subject = getHeader("Subject");
  const from = getHeader("From");
  const to = getHeader("To");
  const date = getHeader("Date");
  const messageIdHeader = getHeader("Message-ID");
  const labelIds = message.labelIds || [];

  // Extract body - Gmail can have different structures
  const getBody = (payload: gmail_v1.Schema$MessagePart): string => {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }

        // Recursively check nested parts
        const nestedBody = getBody(part);
        if (nestedBody) {
          return nestedBody;
        }
      }
    }

    return "";
  };

  // Extract all attachments recursively (images, PDFs, documents, etc.)
  const extractAttachments = (
    payload: gmail_v1.Schema$MessagePart,
  ): GmailParsedAttachment[] => {
    const attachments: GmailParsedAttachment[] = [];
    const partHeaders = payload.headers || [];

    const getPartHeader = (name: string) => {
      const header = partHeaders.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase(),
      );
      return header?.value || "";
    };

    // Check if this part has an attachmentId (any file type)
    if (payload.body?.attachmentId && payload.mimeType) {
      const contentDisposition = getPartHeader("Content-Disposition");
      const contentId = getPartHeader("Content-ID");
      const isInline =
        contentDisposition.toLowerCase().includes("inline") || !!contentId;

      attachments.push({
        attachmentId: payload.body.attachmentId,
        filename: payload.filename || "attachment",
        mimeType: payload.mimeType,
        contentId: contentId ? contentId.replace(/[<>]/g, "") : undefined,
        isInline,
      });
    }

    // Recursively check nested parts
    if (payload.parts) {
      for (const part of payload.parts) {
        attachments.push(...extractAttachments(part));
      }
    }

    return attachments;
  };

  const body = getBody(message.payload || {});
  const attachments = extractAttachments(message.payload || {});

  return {
    id: message.id || messageId,
    threadId: message.threadId || "",
    subject,
    from,
    to,
    date,
    internalDate: message.internalDate || "", // Unix timestamp in milliseconds
    messageId: messageIdHeader,
    body,
    snippet: message.snippet || "",
    labelIds,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export type GmailWebhookEvent = {
  emailAddress: string;
  historyId: number;
};

/**
 * Parse email message to extract useful information
 */
/**
 * Parsed attachment from a Gmail message (images, documents, etc.)
 */
export interface GmailParsedAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  contentId?: string; // For inline images (cid: references)
  isInline: boolean; // Content-Disposition: inline vs attachment
}

export interface GmailEventData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string; // Header date string (for display)
  internalDate: string; // Gmail's internal timestamp (milliseconds since epoch)
  messageId: string;
  body: string;
  snippet: string;
  labelIds: string[];
  // Parsed attachments (images, documents, etc.)
  attachments?: GmailParsedAttachment[];
  // Legacy field - kept for backward compatibility
  images?: GmailParsedAttachment[];
  // Stored files with full metadata (category, mimeType, url)
  storedFiles?: StoredFile[];
}

type ProcessedWebhookClaim =
  | {
      shouldProcess: true;
      integration: PrismaGmailIntegration;
      user: User;
      oldHistoryId: string;
    }
  | {
      shouldProcess: false;
      integration: null;
      user: null;
      oldHistoryId: null;
    };

/**
 * Decode base64url string (Gmail uses base64url encoding)
 */
function decodeBase64Url(str: string): Buffer {
  // Replace URL-safe characters and add padding
  const urlSafe = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = urlSafe.padEnd(
    urlSafe.length + ((4 - (urlSafe.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

/**
 * Downloads attachments from Gmail and stores them in GCS
 * Returns array of StoredFile with metadata (url, mimeType, category)
 */
async function downloadGmailAttachments(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachments: GmailParsedAttachment[],
  integrationId: string,
): Promise<StoredFile[]> {
  try {
    const supportedAttachments = attachments.filter((att) =>
      isSupportedFileType(att.mimeType, att.filename),
    );

    if (supportedAttachments.length === 0) return [];

    logger.info(
      `📎 [GMAIL] Found ${supportedAttachments.length} supported attachment(s) for message ${messageId}`,
      {
        messageId,
        integrationId,
        totalAttachments: attachments.length,
        supportedCount: supportedAttachments.length,
      },
    );

    const results = await Promise.all(
      supportedAttachments.map((attachment) =>
        processGmailAttachment(gmail, messageId, attachment, integrationId),
      ),
    );

    const storedFiles = results.filter((f): f is StoredFile => f !== null);

    return storedFiles;
  } catch (error) {
    // Don't let attachment download failures break the entire event
    logger.error(`Failed to download Gmail attachments`, {
      error,
      messageId,
      integrationId,
      attachmentCount: attachments.length,
    });
    return [];
  }
}

async function processGmailAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachment: GmailParsedAttachment,
  integrationId: string,
): Promise<StoredFile | null> {
  try {
    const primaryKey = buildGmailFileKey(
      integrationId,
      messageId,
      attachment.attachmentId,
    );
    const storedFile = await ensureStoredWithMetadata(
      primaryKey,
      async (): Promise<FileDownloadResult> => {
        const attachmentResponse = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: messageId,
          id: attachment.attachmentId,
        });

        const attachmentData = attachmentResponse.data;
        if (!attachmentData.data) {
          throw new Error("No data in attachment response");
        }

        const buffer = decodeBase64Url(attachmentData.data);
        return {
          data: buffer,
          mimeType: attachment.mimeType || "application/octet-stream",
          filename: attachment.filename,
        };
      },
    );

    if (storedFile) {
      logger.debug(`✅ Stored Gmail attachment in GCS`, {
        messageId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        category: storedFile.category,
        isInline: attachment.isInline,
      });
    }

    return storedFile ?? null;
  } catch (error) {
    logger.error(`Error storing Gmail attachment`, {
      error,
      messageId,
      attachmentId: attachment.attachmentId,
      filename: attachment.filename,
    });
    return null;
  }
}
