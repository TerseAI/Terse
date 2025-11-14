import chalk from "chalk";
import crypto from "crypto";
import { Request, Response } from "express";
import { gmail_v1, google } from "googleapis";
import { EventProcessor, ProcessorResult } from "../agent/AutomationAgent/EventProcessor";
import { db } from "../prismaClient";
import { GmailIntegration, User } from "../types/prisma";
import { gmail as gmailConfig, urls, cloudScheduler } from "../config/settings";
import { GmailEvent } from "src/Updater/InputEvents";

// OAuth2 scopes for Gmail
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    gmailConfig.clientId,
    gmailConfig.clientSecret,
    gmailConfig.redirectUri
  );
}

/**
 * Generate Gmail OAuth URL
 */
export async function getGmailOAuthUrl(req: Request, res: Response) {
  console.log("getGmailOAuthUrl route hit");

  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const oauth2Client = getOAuth2Client();

    // Generate state for security (include user ID)
    const state = Buffer.from(
      JSON.stringify({
        userId: req.session.user.id,
        random: crypto.randomBytes(16).toString("hex"),
      })
    ).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Get refresh token
      scope: SCOPES,
      state: state,
      prompt: "consent", // Force consent screen to get refresh token
    });

    res.json({ url: authUrl });
  } catch (error) {
    console.error("Error generating Gmail OAuth URL:", error);
    res.status(500).json({ error: "Failed to generate OAuth URL" });
  }
}

/**
 * Handle Gmail OAuth callback
 */
export async function gmailCallback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };

  console.log("Gmail OAuth callback received");

  if (!code || !state) {
    return res.redirect(`${urls.frontend}/oauth/error`);
  }

  try {
    // Decode state to get user ID
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const userId = stateData.userId;

    if (!userId) {
      return res.redirect(`${urls.frontend}/oauth/error`);
    }

    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token || !tokens.refresh_token) {
      return res.redirect(`${urls.frontend}/oauth/error`);
    }

    // Get user's email address
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress;

    if (!emailAddress) {
      return res.redirect(`${urls.frontend}/oauth/error`);
    }

    // Set up Gmail watch
    const watchResponse = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: gmailConfig.pubsubTopic,
        labelIds: ["INBOX"],
        labelFilterAction: "include"
      },
    });

    const historyId = watchResponse.data.historyId;
    const expiration = watchResponse.data.expiration;

    if (!historyId || !expiration) {
      return res.redirect(`${urls.frontend}/oauth/error`);
    }

    // Calculate token expiry
    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Store in database and set is_active to true
    await db().gmail_integrations.upsert({
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

    console.log(`Gmail integration activated for ${emailAddress}`);

    // Redirect to success page which will auto-close the popup
    res.redirect(`${urls.frontend}/oauth/success`);
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    res.redirect(`${urls.frontend}/oauth/error`);
  }
}

/**
 * Disable Gmail integration (set is_active to false)
 */
export async function deleteGmailIntegration(req: Request, res: Response) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get the active integration
    const integration = await db().gmail_integrations.findFirst({
      where: {
        user_id: req.session.user.id,
        is_active: true,
      },
    });

    if (!integration) {
      return res
        .status(404)
        .json({ error: "No active Gmail integration found" });
    }

    // Set up OAuth client with stored credentials
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expiry.getTime(),
    });

    try {
      // Stop the Gmail watch
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      await gmail.users.stop({ userId: "me" });
      console.log(`Gmail watch stopped for ${integration.email}`);
    } catch (stopError) {
      // Log but don't fail the deactivation if watch stop fails
      // (watch might already be expired or stopped)
      console.warn("Error stopping Gmail watch:", stopError);
    }

    // Clean up automation inputs/outputs that reference this Gmail integration
    await db().automation_inputs.deleteMany({
      where: {
        integration_type: "GMAIL",
        integration_id: integration.id,
      },
    });

    await db().automation_outputs.deleteMany({
      where: {
        integration_type: "GMAIL",
        integration_id: integration.id,
      },
    });

    // Set is_active to false instead of deleting
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: { is_active: false },
    });

    console.log(
      `Gmail integration deactivated for user ${req.session.user.id}`
    );
    res.json({ message: "Gmail integration disabled successfully" });
  } catch (error) {
    console.error("Error disabling Gmail integration:", error);
    res.status(500).json({ error: "Failed to disable Gmail integration" });
  }
}

/**
 * Refresh access token if expired
 */
async function refreshAccessTokenIfNeeded(
  integration: GmailIntegration
): Promise<string> {
  const now = new Date();

  // Check if token is expired or will expire in the next 5 minutes
  if (
    integration.token_expiry &&
    integration.token_expiry <= new Date(now.getTime() + 5 * 60 * 1000)
  ) {
    console.log("Access token expired or expiring soon, refreshing...");

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

    console.log("Access token refreshed successfully");

    return credentials.access_token!;
  }

  return integration.access_token;
}

/**
 * Fetch new message IDs from Gmail history
 */
async function fetchNewMessageIds(
  integration: GmailIntegration,
  oldHistoryId: string
): Promise<string[]> {
  // Refresh token if needed
  const accessToken = await refreshAccessTokenIfNeeded(integration);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: integration.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  console.log(`Fetching Gmail history from ${oldHistoryId}`);

  const historyResponse = await gmail.users.history.list({
    userId: "me",
    startHistoryId: oldHistoryId,
    historyTypes: ["messageAdded"],
    labelId: "INBOX",
  });

  const history = historyResponse.data.history || [];

  if (history.length === 0) {
    console.log("No new messages in history");
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

  console.log(`Found ${messageIds.length} new messages`);

  return messageIds;
}

/**
 * Parse email message to extract useful information
 */
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
}

async function fetchAndParseEmail(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailEventData | null> {
  try {
    const messageResponse = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = messageResponse.data;
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase()
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

    const body = getBody(message.payload || {});

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
    };
  } catch (error: any) {
    // 404 errors are expected - messages can be deleted/moved before we fetch them
    if (
      error?.code === 404 ||
      error?.message?.includes("Requested entity was not found")
    ) {
      console.log(
        chalk.gray(`Message ${messageId} not found (likely deleted or moved)`)
      );
    } else {
      // Log other errors as actual errors
      console.error(`Error fetching message ${messageId}:`, error);
    }
    return null;
  }
}

/**
 * Webhook handler for Gmail Pub/Sub notifications
 */

// TODO: Might be worth building a summary of the entire thread for added context of the current event.

type GmailWebhookData = {
  emailAddress: string;
  historyId: number;
};

type ProcessedWebhookClaim = {
  shouldProcess: true;
  integration: GmailIntegration;
  user: User;
  oldHistoryId: string;
} | {
  shouldProcess: false;
  integration: null;
  user: null;
  oldHistoryId: null;
};

/**
 * Webhook handler for Gmail Pub/Sub notifications
 * Extracts data from request and immediately acknowledges, then processes asynchronously
 */
export async function handleGmailWebhook(req: Request, res: Response) {
  console.log(
    chalk.bgMagenta.white("Gmail webhook received:"),
    chalk.magentaBright(JSON.stringify(req.body, null, 2))
  );

  // Extract and validate webhook data
  const webhookData = extractWebhookData(req);
  if (!webhookData) {
    return res.status(400).send('Invalid message format');
  }

  // Immediately acknowledge to Gmail to prevent duplicate deliveries
  res.status(200).send('OK');

  // Process asynchronously (don't await - let it run in background)
  processGmailWebhook(webhookData.emailAddress, webhookData.historyId).catch((error) => {
    console.error('Gmail webhook processing error:', error);
    // Don't send error response since we already acked the webhook
    // Gmail will retry if we don't ack, but we already did
  });
}

/**
 * Process a Gmail webhook notification
 * This is called asynchronously after the webhook is acknowledged
 * Only the critical history ID claim is in a transaction; rest is fast and non-blocking
 */
async function processGmailWebhook(emailAddress: string, historyId: number): Promise<void> {
  console.log(`Gmail notification for ${emailAddress}, historyId: ${historyId}`);

  try {
    // Step 1: Atomically claim this history ID update (CRITICAL SECTION - in transaction)
    const claims = await db().$transaction(async (tx) => {
      return await claimHistoryIdUpdateInTransaction(tx, emailAddress, historyId);
    });

    if (claims.length === 0) {
      console.log(`Skipping webhook processing for ${emailAddress}`);
      return;
    }

    for (const claim of claims) {
      if (!claim.shouldProcess) {
        continue;
      }
      const { integration, user, oldHistoryId } = claim;
      // Step 2: Fetch message IDs from Gmail (fast, non-blocking)
      const messageIds = await fetchNewMessageIds(integration, oldHistoryId);

      if (messageIds.length === 0) {
        console.log(`No new messages to process for ${emailAddress}`);
        return;
      }

      // Step 3: Set up Gmail client (fast, non-blocking)
      const accessToken = await refreshAccessTokenIfNeeded(integration);
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: integration.refresh_token,
      });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const lastProcessedDate: Date | null = integration.last_processed_message_date;
      let mostRecentEmailDate: Date | null = lastProcessedDate;

      // Step 4: Process each message (fast, non-blocking)
      for (const messageId of messageIds) {
        // Try to mark this message as processed (non-blocking, unique constraint prevents duplicates)
        const wasNewlyProcessed = await markMessageAsProcessed(
          integration.id,
          messageId,
          String(Date.now())
        );

        if (!wasNewlyProcessed) {
          console.log(chalk.yellow(`Skipping already processed message ${messageId}`));
          continue;
        }

        const parsedEmail: GmailEventData | null = await fetchAndParseEmail(gmail, messageId);

        if (parsedEmail) {
          const emailTimestamp = parseInt(parsedEmail.internalDate, 10);
          const emailDate = new Date(emailTimestamp);

          console.log("Recieved Webhook for email:")
          console.log("Email From: ", parsedEmail.from);
          console.log("Email to: ", parsedEmail.to);
          console.log("Email subject: ", parsedEmail.subject);
          console.log("Email date: ", emailDate.toISOString());

          // Skip messages older than the last processed message date
          if (lastProcessedDate && emailDate <= lastProcessedDate) {
            console.log(chalk.gray(`Skipping old message ${parsedEmail.id} from ${emailDate.toISOString()}`));
            console.log(chalk.gray(`  Subject: ${parsedEmail.subject}`));

            // Mark as processed (non-blocking)
            await markMessageAsProcessed(integration.id, parsedEmail.id, parsedEmail.internalDate);
            continue;
          }

          // Process email through automations (non-blocking)
          console.log(chalk.cyan('About to process email:'));
          console.log(chalk.cyan(`  Integration for user: ${user.email}`));
          console.log(chalk.cyan(`  Subject: ${parsedEmail.subject}`));
          console.log(chalk.cyan(`  From: ${parsedEmail.from}`));
          console.log(chalk.cyan(`  To: ${parsedEmail.to}`));
          console.log(chalk.cyan(`  Date: ${emailDate.toISOString()}`));

          const eventProcessor = new EventProcessor(new GmailEvent(parsedEmail, integration.id), user);
          const results = await eventProcessor.process();

          // Process results from all automations
          let hasSuccess = false;
          for (const result of results) {
            if (result.success) {
              console.log(chalk.green(`Email processed successfully by automation: ${result.automation?.name}`));
              hasSuccess = true;
            } else {
              console.log(chalk.gray(`Automation "${result.automation?.name || 'unknown'}" skipped: ${result.message}`));
            }
          }

          // Track the most recent email date if processing succeeded
          if (hasSuccess && (!mostRecentEmailDate || emailDate > mostRecentEmailDate)) {
            mostRecentEmailDate = emailDate;
          }
        }
      }

      // Step 5: Update the last processed message date (non-blocking)
      if (mostRecentEmailDate && mostRecentEmailDate !== lastProcessedDate) {
        await db().gmail_integrations.update({
          where: { id: integration.id },
          data: { last_processed_message_date: mostRecentEmailDate },
        });
        console.log(chalk.green(`Updated last processed message date to ${mostRecentEmailDate.toISOString()}`));
      }

      console.log(`Successfully processed webhook for ${emailAddress}, historyId: ${historyId}`);
    }
  } catch (error) {
    console.error('Error processing Gmail webhook:', error);
    // Re-throw to ensure it's logged by the caller
    throw error;
  }
}

/**
 * Atomically claim a history ID update within an existing transaction
 * Returns null if the webhook should be skipped (already processed or no integration)
 */
async function claimHistoryIdUpdateInTransaction(
  tx: any,
  emailAddress: string, // This is the email belonging to the gmail watch webhook
  newHistoryId: number
): Promise<ProcessedWebhookClaim[]> {
  const newHistoryIdString = newHistoryId.toString();

  console.log("Getting Integrations associated with email:", emailAddress, "new history id:", newHistoryIdString);
  const integrations = await tx.gmail_integrations.findMany({
    where: {
      email: emailAddress,
      is_active: true,
    },
  });

  if (!integrations || integrations.length === 0) {
    console.log('No active integrations found for email:', emailAddress);
    return [{ shouldProcess: false, integration: null, user: null, oldHistoryId: null }];
  }

  const claims: ProcessedWebhookClaim[] = await Promise.all(
    integrations.map(async (integration: GmailIntegration) => {
      const oldHistoryId = integration.history_id;
      const currentHistoryId = parseInt(integration.history_id, 10);
      if (newHistoryId <= currentHistoryId) {
        console.log(
          chalk.yellow(
            `Skipping webhook: historyId ${newHistoryId} is not newer than current ${currentHistoryId}`
          )
        );
        return { shouldProcess: false, integration: null, user: null, oldHistoryId: null };
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
        console.log('No user found for integration:', integration.user_id);
        return { shouldProcess: false, integration: null, user: null, oldHistoryId: null };
      }

      return {
        shouldProcess: true,
        integration: updatedIntegration,
        user: user,
        oldHistoryId: oldHistoryId,
      };
    })
  );
  return claims;
}

/**
 * Extract and validate webhook data from the request
 */
function extractWebhookData(req: Request): { emailAddress: string; historyId: number } | null {
  const { message } = req.body;

  if (!message || !message.data) {
    return null;
  }

  try {
    const decoded: GmailWebhookData = JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    );

    return {
      emailAddress: decoded.emailAddress,
      historyId: decoded.historyId,
    };
  } catch (error) {
    console.error('Error decoding webhook data:', error);
    return null;
  }
}

/**
 * Mark a message as processed in the database
 * Returns true if the message was newly marked, false if it was already processed
 * Uses unique constraint to prevent duplicates (fast, non-blocking)
 */
async function markMessageAsProcessed(
  integrationId: string,
  messageId: string,
  internalDate: string
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
    if (error.code === 'P2002') {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}


/**
 * Validate that the request comes from Google Cloud Scheduler
 * Validates the secret token in the Authorization header
 */
function validateCloudSchedulerRequest(req: Request): boolean {
  const authHeader = req.headers['authorization'];
  
  // Cloud Scheduler should send the secret token in the Authorization header
  // Format: "Bearer <token>" or just the token value
  if (!authHeader) {
    console.log('Missing Authorization header');
    return false;
  }

  // Extract token from "Bearer <token>" or just check the header value
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  // Validate against configured secret
  if (token !== cloudScheduler.secret) {
    console.log('Invalid cron secret token');
    return false;
  }

  return true;
}

/**
 * Refresh Gmail watch for a single integration
 */
async function refreshGmailWatch(integration: GmailIntegration): Promise<boolean> {
  try {
    console.log(`Refreshing Gmail watch for ${integration.email} (integration ID: ${integration.id})`);

    // Refresh access token if needed
    const accessToken = await refreshAccessTokenIfNeeded(integration);

    // Set up OAuth client with stored credentials
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expiry.getTime(),
    });

    // Get Gmail client
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Refresh the watch
    const watchResponse = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: gmailConfig.pubsubTopic,
        labelIds: ["INBOX"],
        labelFilterAction: "include"
      },
    });

    const historyId = watchResponse.data.historyId;
    const expiration = watchResponse.data.expiration;

    if (!historyId || !expiration) {
      console.error(`Failed to refresh watch for ${integration.id}: Missing historyId or expiration`);
      return false;
    }

    // Update the database with new watch information
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: {
        history_id: historyId,
        watch_expiration: new Date(parseInt(expiration)),
      },
    });

    console.log(`Successfully refreshed Gmail watch for ${integration.id}. New expiration: ${new Date(parseInt(expiration)).toISOString()}`);
    return true;
  } catch (error: any) {
    console.error(`Error refreshing Gmail watch for ${integration.id}:`, error);
    return false;
  }
}

/**
 * Cron job endpoint to refresh all Gmail watch subscriptions
 * This endpoint is triggered by Google Cloud Scheduler
 */
export async function refreshAllGmailWatches(req: Request, res: Response) {
  console.log('Gmail watch refresh cron job triggered');

  // Validate request comes from Google Cloud Scheduler
  if (!validateCloudSchedulerRequest(req)) {
    console.error('Unauthorized: Request did not pass Cloud Scheduler validation');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch all active Gmail integrations
    const integrations = await db().gmail_integrations.findMany({
      where: {
        is_active: true,
      },
    });

    console.log(`Found ${integrations.length} active Gmail integrations to refresh`);

    if (integrations.length === 0) {
      return res.json({
        message: 'No active Gmail integrations found',
        refreshed: 0,
        failed: 0,
      });
    }

    // Refresh watches for each integration
    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (const integration of integrations) {
      const success = await refreshGmailWatch(integration);
      if (success) {
        successCount++;
      } else {
        failureCount++;
        failures.push({
          email: integration.email,
          error: 'Watch refresh failed - see logs for details',
        });
      }
    }

    console.log(`Gmail watch refresh completed: ${successCount} succeeded, ${failureCount} failed`);

    return res.json({
      message: 'Gmail watch refresh completed',
      total: integrations.length,
      refreshed: successCount,
      failed: failureCount,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (error) {
    console.error('Error in Gmail watch refresh cron job:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  getGmailOAuthUrl,
  gmailCallback,
  deleteGmailIntegration,
  handleGmailWebhook,
  refreshAllGmailWatches,
};
