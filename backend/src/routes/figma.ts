import { Request, Response } from "express";
import chalk from "chalk";
import { FigmaIntegrationManager, FigmaWebhookEvent } from "../integrations/FigmaIntegration";
import { FigmaEventTypes } from "../shared/types";
import logger from "../logger";

// MARK: - Route Handlers

export async function getFigmaIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
  }

  try {
      const manager = new FigmaIntegrationManager();
      const integrations = await manager.getInstancesForUser(req.session.user.id);
      res.status(200).json(integrations);
  } catch (error) {
      logger.error('Error fetching Figma integrations', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId: req.session.user.id });
      res.status(500).json({ error: 'Failed to fetch Figma integrations' });
  }
}

/**
 * Handle Figma OAuth callback
 */
export const figmaOAuthCallback = async (req: Request, res: Response) => {
  const integration = new FigmaIntegrationManager();
  await integration.processInstallationCallback(req, res);
};

/**
 * Webhook handler for Figma comment events
 * POST /webhooks/figma
 */
export const handleFigmaWebhook = async (req: Request, res: Response) => {
  logger.debug("Figma webhook received", { eventType: req.body?.event_type, hasBody: !!req.body });

  try {
    const webhookEvent = req.body as FigmaWebhookEvent;
    const eventType = webhookEvent.event_type;

    const supportedEventTypes = Object.values(FigmaEventTypes);

    if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
      logger.warn(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`, { eventType });
      res.status(200).json({ received: true });
      return;
    }

    // Acknowledge immediately to prevent spamming the webhook
    res.status(200).json({ received: true });

    // Process the event asynchronously
    const figmaIntegrationManager = new FigmaIntegrationManager();
    figmaIntegrationManager.processWebhookEvent(webhookEvent).catch((error) => {
      logger.error('Error processing Figma webhook event', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, eventType: webhookEvent.event_type });
    });
  } catch (error) {
    logger.error("Error in handleFigmaWebhook", { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
  }
};
