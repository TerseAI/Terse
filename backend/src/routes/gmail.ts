import chalk from "chalk";
import crypto from "crypto";
import { Request, Response } from "express";
import { google } from "googleapis";
import { db } from "../prismaClient";
import { GmailIntegration} from "../types/prisma";
import { gmail as gmailConfig, urls, cloudScheduler, OAUTH_TOKEN_REFRESH_THRESHOLD_MS } from "../config/settings";
import { getOAuth2Client, GmailIntegrationManager, GmailWebhookEvent } from "../integrations/GmailIntegration";
import { InputConfigType } from "@prisma/client";
import logger from "../logger";

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
      logger.error('Error fetching Gmail integrations:', { error });
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
      logger.info(`Gmail watch stopped for ${integration.email}`);
    } catch (stopError) {
      // Log but don't fail the deactivation if watch stop fails
      // (watch might already be expired or stopped)
      logger.warn("Error stopping Gmail watch:", { error: stopError });
    }

    // Clean up channel inputs/outputs that reference this Gmail integration
    await db().automation_inputs.deleteMany({
      where: {
        config_type: InputConfigType.GMAIL,
        integration_id: integration.id,
      },
    });

    // Note: Gmail is not a valid output type (only NOTION_PAGE, NOTION_DATABASE, CONFLUENCE are supported)
    // No channel outputs to delete for Gmail integrations

    // Set is_active to false instead of deleting
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: { is_active: false },
    });

    logger.info(
      `Gmail integration deactivated for user ${req.session.user.id}`
    );
    res.json({ message: "Gmail integration disabled successfully" });
  } catch (error) {
    logger.error("Error disabling Gmail integration:", { error });
    res.status(500).json({ error: "Failed to disable Gmail integration" });
  }
}

/**
 * Webhook handler for Gmail Pub/Sub notifications
 * Extracts data from request and immediately acknowledges, then processes asynchronously
 */
export async function handleGmailWebhook(req: Request, res: Response) {
  logger.info("Gmail webhook received", { body: req.body });

  // Extract and validate webhook data
  const webhookData = extractWebhookData(req);
  if (!webhookData) {
    return res.status(400).send('Invalid message format');
  }

  // Immediately acknowledge to Gmail to prevent duplicate deliveries
  res.status(200).send('OK');

  const gmailIntegration = new GmailIntegrationManager();
  try {
    await gmailIntegration.processWebhookEvent({
      emailAddress: webhookData.emailAddress,
      historyId: webhookData.historyId,
    })
  } catch (error) {
    logger.error('Error processing Gmail webhook:', { error });
  }
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
    logger.error('Error decoding webhook data:', { error });
    return null;
  }
}



export default {
  gmailCallback,
  deleteGmailIntegration,
  handleGmailWebhook,
};
