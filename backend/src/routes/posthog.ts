import { Request, Response } from "express";
import { PosthogIntegrationManager } from "../integrations/PosthogIntegration";
import logger from "../logger";


export async function getPosthogIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
  
    try {
        const manager = new PosthogIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        logger.error('Error fetching Posthog integrations:', { error });
        res.status(500).json({ error: 'Failed to fetch Posthog integrations' });
    }
}

export async function createOrUpdatePosthogIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new PosthogIntegrationManager();
        await manager.processFormSubmission(req, res);
    } catch (error) {
        logger.error('Error creating/updating Posthog integration:', { error });
        res.status(500).json({ error: 'Failed to process integration' });
    }
}