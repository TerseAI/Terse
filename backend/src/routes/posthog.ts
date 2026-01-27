import { Request, Response } from "express";
import { PosthogIntegrationManager } from "../integrations/PosthogIntegration";
import { PosthogProjectsResponse } from "../shared/types";
import logger from "../logger";
import { parseFormSubmissionFromRequest } from "../integrations/abstract/Integration";
import { IntegrationType } from "../shared/Integrations";
import { emitIntegrationFormCompletedTaskIfNeeded } from "../integrations/helpers/emitIntegrationFormCompletedTask";


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
    const input = parseFormSubmissionFromRequest(req);
    if (!input) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new PosthogIntegrationManager();
        const result = await manager.processFormSubmission(input);
        
        if (!result.success) {
            res.status(result.statusCode || 500).json({ 
                error: result.error || 'Failed to process integration',
                ...(result.data || {})
            });
            return;
        }

        // Check for state token in query params or body and emit task if needed
        const stateToken = (req.query.state as string) || req.body?.state;
        await emitIntegrationFormCompletedTaskIfNeeded(
            stateToken,
            manager,
            input.userId,
            IntegrationType.POSTHOG
        );

        res.status(result.statusCode || 200).json(result.data || { success: true });
    } catch (error) {
        logger.error('Error creating/updating Posthog integration:', { error });
        res.status(500).json({ error: 'Failed to process integration' });
    }
}

// Get Posthog projects for an integration
export const getPosthogProjects = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
        return res.status(400).json({ error: "integrationId is required" });
    }

    // Search term is optional - empty string returns all projects
    const search = (req.query.search as string) || "";

    try {
        const responseData = await fetchPosthogProjects(user.id, integrationId, search);
        res.status(200).json(responseData);
    } catch (error: any) {
        logger.error('Error fetching Posthog projects:', { error });
        res.status(500).json({
            error: "Failed to fetch projects",
            details: error.message
        });
    }
};

export const fetchPosthogProjects = async (
    userId: string,
    integrationId: string,
    search: string = ""
): Promise<PosthogProjectsResponse> => {
    const manager = new PosthogIntegrationManager();
    const projects = await manager.fetchResourcesForInstance(userId, integrationId, search);
    return { projects };
};