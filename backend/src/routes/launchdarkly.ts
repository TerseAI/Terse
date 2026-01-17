import { Request, Response } from "express";
import { LaunchDarklyIntegrationManager } from "../integrations/LaunchDarklyIntegration";
import { db } from "../prismaClient";
import logger from "../logger";


export async function getLaunchDarklyIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
  
    try {
        const manager = new LaunchDarklyIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        logger.error('Error fetching LaunchDarkly integrations:', { error });
        res.status(500).json({ error: 'Failed to fetch LaunchDarkly integrations' });
    }
}

export async function createOrUpdateLaunchDarklyIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new LaunchDarklyIntegrationManager();
        await manager.processFormSubmission(req, res);
    } catch (error) {
        logger.error('Error creating/updating LaunchDarkly integration:', { error });
        res.status(500).json({ error: 'Failed to process integration' });
    }
}
