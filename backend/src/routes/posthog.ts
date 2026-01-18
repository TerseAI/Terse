import { Request, Response } from "express";
import { PosthogIntegrationManager } from "../integrations/PosthogIntegration";
import { PosthogProjectsResponse } from "../shared/types";
import { db } from "../prismaClient";
import logger from "../logger";
import { parseFormSubmissionFromRequest } from "../integrations/abstract/Integration";


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
    const integration = await db().posthog_integrations.findFirst({
        where: {
            id: integrationId,
            user_id: userId,
        },
    });

    if (!integration) {
        throw new Error("Posthog integration not found");
    }

    const apiUrl = 'https://us.posthog.com/api/projects/';
    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${integration.api_key}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('Posthog API error fetching projects', {
            status: response.status,
            error: errorText,
        });
        throw new Error(response.status === 401 ? 'Invalid API key' : errorText);
    }

    const data = await response.json();
    let projects = Array.isArray(data) ? data : (data.results || data.data || []);
    
    if (search) {
        const searchLower = search.toLowerCase();
        projects = projects.filter((project: any) => 
            project.name?.toLowerCase().includes(searchLower) ||
            project.id?.toString().toLowerCase().includes(searchLower)
        );
    }

    const mappedProjects = projects.map((project: any) => ({
        id: project.id?.toString() || project.uuid || '',
        name: project.name || 'Unnamed Project',
        organization_id: project.organization_id || project.organization?.id || undefined,
    })).filter((project: any) => project.id);

    if (!search) {
        mappedProjects.sort((a: { name: string }, b: { name: string }) => 
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
    }

    return {
        projects: mappedProjects,
    };
};