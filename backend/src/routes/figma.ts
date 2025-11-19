import { Request, Response } from "express";
import chalk from "chalk";
import { FigmaIntegrationManager, FigmaWebhookEvent } from "../integrations/FigmaIntegration";
import { FigmaEventTypes } from "../shared/types";

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
      console.error('Error fetching Figma integrations:', error);
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
  console.log(
    chalk.bgMagenta.white("Figma webhook received:"),
    chalk.magentaBright(JSON.stringify(req.body, null, 2))
  );

  try {
    const webhookEvent = req.body as FigmaWebhookEvent;
    const eventType = webhookEvent.event_type;

    const supportedEventTypes = Object.values(FigmaEventTypes);

    if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
      console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`));
      res.status(200).json({ received: true });
      return;
    }

    // Acknowledge immediately to prevent spamming the webhook
    res.status(200).json({ received: true });

    // Process the event asynchronously
    const figmaIntegrationManager = new FigmaIntegrationManager();
    figmaIntegrationManager.processWebhookEvent(webhookEvent).catch((error) => {
      console.error(chalk.red('Error processing Figma webhook event:'), error);
    });
  } catch (error) {
    console.error(chalk.red("Error in handleFigmaWebhook:"), error);
  }
};
