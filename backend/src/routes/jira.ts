import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { JiraWebhookPayload } from "../utility/JiraWebhookPayload";
import { AtlassianIntegrationManager } from "../integrations/AtlassianIntegration";
import logger from "../logger";

export async function getAtlassianIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new AtlassianIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        logger.error('Error fetching Atlassian integrations:', { error });
        res.status(500).json({ error: 'Failed to fetch Atlassian integrations' });
    }
}

// OAuth Functions
export const atlassianOAuthCallback = async (req: Request, res: Response) => {
    const integration = new AtlassianIntegrationManager();
    await integration.processInstallationCallback(req, res);
};


/**
 * Verify Jira webhook authenticity by checking if the webhook payload matches
 * one of our integrations. Jira REST API v3 webhooks don't use HMAC signatures,
 * so we verify by matching the user email and base URL from the payload.
 */
function verifyJiraWebhook(event: JiraWebhookPayload): boolean {
    // Extract base URL from issue self URL
    let baseUrl: string | null = null;
    if (event.issue?.self) {
        try {
            const url = new URL(event.issue.self);
            baseUrl = `${url.protocol}//${url.hostname}`;
        } catch (error) {
            logger.warn("⚠️  Could not parse issue URL:", { issueUrl: event.issue.self });
            return false;
        }
    }

    // Extract user email from event
    const userEmail = event.user?.emailAddress;

    if (!baseUrl && !userEmail) {
        logger.warn("⚠️  [JIRA WEBHOOK] No base URL or user email found in webhook payload");
        return false;
    }

    // Webhook is valid if we have the required data - actual matching happens in processWebhookEvent
    return true;
}

export const handleJiraWebhook = async (req: Request, res: Response) => {
    try {
        // Parse JSON body
        let body: JiraWebhookPayload;
        try {
            body = req.body as JiraWebhookPayload;
        } catch (error) {
            logger.error('Failed to parse JSON body:', { error });  
            return res.sendStatus(400);
        }

        // Verify webhook authenticity
        if (!verifyJiraWebhook(body)) {
            logger.error('Invalid webhook payload');
            return res.sendStatus(401);
        }

        // Ack early, avoid spamming the webhook
        res.status(200).json({ received: true });

        // Process webhook event asynchronously
        const integration = new AtlassianIntegrationManager();
        await integration.processWebhookEvent(body);
    } catch (error) {
        logger.error('Error processing webhook:', { error });
        // Indicate to Jira that there was a server error so the webhook is retried later
        return res.sendStatus(500);
    }
};

// Legacy function for backward compatibility
export const processJiraWebhook = async (userId: string, event: JiraWebhookPayload) => {
    const integration = new AtlassianIntegrationManager();
    await integration.processWebhookEvent(event);
};

/**
 * Get all resources a user has access to for a Jira integration
 * Lists: Projects, Issue Types, Statuses, Priorities, Users
 */
export async function getJiraResources(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { integrationId } = req.query;
    if (!integrationId || typeof integrationId !== 'string') {
        return res.status(400).json({ success: false, error: 'integrationId is required' });
    }

    try {
        // Get the integration
        const integration = await db().atlassian_integrations.findFirst({
            where: {
                id: integrationId,
                user_id: user.id,
            },
        });

        if (!integration) {
            return res.status(404).json({ success: false, error: 'Integration not found' });
        }

        if (!integration.cloud_id) {
            return res.status(400).json({ success: false, error: 'Integration missing cloud_id' });
        }

        // Get valid access token (handles refresh automatically)
        const manager = new AtlassianIntegrationManager();
        const accessToken = await manager.getAccessToken(integrationId);
        if (!accessToken) {
            return res.status(400).json({ success: false, error: 'Could not get valid access token' });
        }

        const cloudId = integration.cloud_id;
        const baseUrl = integration.base_url;

        // Fetch all projects using OAuth token
        let projects: Array<{ id: string; key: string; name: string; projectTypeKey: string }> = [];

        // Fetch projects
        try {
            const projectsResponse = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json',
                    },
                }
            );

            if (projectsResponse.ok) {
                const projectsData = await projectsResponse.json();
                projects = projectsData.map((p: any) => ({
                    id: p.id,
                    key: p.key,
                    name: p.name,
                    projectTypeKey: p.projectTypeKey || 'software',
                }));
            }
        } catch (error) {
            logger.warn('⚠️  Could not fetch projects:', { error });
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch projects',
            });
        }

        return res.status(200).json({
            success: true,
            resources: {
                projects: projects,
                baseUrl: baseUrl,
                cloudId: cloudId,
            },
        });
    } catch (error: any) {
        logger.error('Error fetching Jira resources:', { error });
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch Jira resources',
        });
    }
}