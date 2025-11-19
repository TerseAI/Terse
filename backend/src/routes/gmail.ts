import chalk from "chalk";
import crypto from "crypto";
import { Request, Response } from "express";
import { google } from "googleapis";
import { db } from "../prismaClient";
import { GmailIntegration} from "../types/prisma";
import { gmail as gmailConfig, urls, cloudScheduler } from "../config/settings";
import { getOAuth2Client, GmailIntegrationManager, GmailWebhookEvent } from "../integrations/GmailIntegration";
import { InputConfigType } from "@prisma/client";

// OAuth2 scopes for Gmail
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];


export async function getGmailIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
  }

  try {
      const manager = new GmailIntegrationManager();
      const integrations = await manager.getInstancesForUser(req.session.user.id);
      res.status(200).json(integrations);
  } catch (error) {
      console.error('Error fetching Gmail integrations:', error);
      res.status(500).json({ error: 'Failed to fetch Gmail integrations' });
  }
}

/**
 * Handle Gmail OAuth callback
 */
export async function gmailCallback(req: Request, res: Response) {
  const integration = new GmailIntegrationManager();
  await integration.processInstallationCallback(req, res);
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
        config_type: InputConfigType.GMAIL,
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

  const gmailIntegration = new GmailIntegrationManager();
  await gmailIntegration.processWebhookEvent({
    emailAddress: webhookData.emailAddress,
    historyId: webhookData.historyId,
  });
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
    const decoded: GmailWebhookEvent = JSON.parse(
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
  gmailCallback,
  deleteGmailIntegration,
  handleGmailWebhook,
  refreshAllGmailWatches,
};
