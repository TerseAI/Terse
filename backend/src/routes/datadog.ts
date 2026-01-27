import { Request, Response } from "express";
import { DatadogIntegrationManager } from "../integrations/DatadogIntegration";
import { parseFormSubmissionFromRequest } from "../integrations/abstract/Integration";
import { db } from "../prismaClient";
import logger from "../logger";
import { getDatadogApiUrl } from "../utility/datadog";
import { IntegrationType } from "../shared/Integrations";
import { emitIntegrationFormCompletedTaskIfNeeded } from "../integrations/helpers/emitIntegrationFormCompletedTask";

export async function getDatadogIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
  
    try {
        const manager = new DatadogIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        logger.error('Error fetching Datadog integrations:', { error });
        res.status(500).json({ error: 'Failed to fetch Datadog integrations' });
    }
}

export async function createOrUpdateDatadogIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const input = parseFormSubmissionFromRequest(req);
        if (!input) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const manager = new DatadogIntegrationManager();
        const result = await manager.processFormSubmission(input);
        
        if (!result.success) {
            res.status(result.statusCode ?? 400).json(result);
            return;
        }

        // Check for state token in query params or body and emit task if needed
        const stateToken = (req.query.state as string) || req.body?.state;
        await emitIntegrationFormCompletedTaskIfNeeded(
            stateToken,
            manager,
            input.userId,
            IntegrationType.DATADOG
        );

        res.status(result.statusCode ?? 200).json(result);
    } catch (error) {
        logger.error('Error creating/updating Datadog integration:', { error });
        res.status(500).json({ error: 'Failed to process integration' });
    }
}

// Get Datadog indexes for an integration
export const getDatadogIndexes = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
        return res.status(400).json({ error: "integrationId is required" });
    }

    // Optional: include disabled indexes
    const includeDisabled = req.query.includeDisabled === 'true';

    try {
        // Verify user owns this integration
        const integration = await db().datadog_integrations.findFirst({
            where: {
                id: integrationId,
                user_id: user.id,
            },
        });

        if (!integration) {
            return res.status(404).json({ error: "Datadog integration not found" });
        }

        // Fetch indexes from Datadog API
        // Datadog API endpoint: GET /api/v1/logs/config/indexes
        const apiUrl = getDatadogApiUrl(integration.region);
        const response = await fetch(`${apiUrl}/api/v1/logs/config/indexes`, {
            method: 'GET',
            headers: {
                'DD-API-KEY': integration.api_key,
                'DD-APPLICATION-KEY': integration.app_key,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Datadog API error fetching indexes', {
                status: response.status,
                error: errorText,
                integrationId,
            });
            
            if (response.status === 401 || response.status === 403) {
                return res.status(response.status).json({
                    error: "Failed to fetch indexes from Datadog",
                    details: response.status === 401 ? 'Invalid API key or APP key' : 'Missing logs_read_config permission'
                });
            }
            
            return res.status(response.status).json({
                error: "Failed to fetch indexes from Datadog",
                details: errorText
            });
        }

        const data = await response.json();
        
        // Datadog API returns an array of index objects
        let indexes = Array.isArray(data) ? data : (data.indexes || data.data || []);
        
        // Filter to only enabled indexes by default
        if (!includeDisabled) {
            indexes = indexes.filter((index: any) => index.is_enabled !== false);
        }

        // Map to our format
        const mappedIndexes = indexes.map((index: any) => ({
            id: index.name || index.id || '',
            name: index.name || 'Unnamed Index',
            isEnabled: index.is_enabled !== false,
            dailyLimit: index.daily_limit || undefined,
            retentionDays: index.num_retention_days || undefined,
        })).filter((index: any) => index.id); // Filter out indexes without IDs

        // Sort alphabetically
        mappedIndexes.sort((a: { name: string }, b: { name: string }) => 
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

        res.status(200).json({
            indexes: mappedIndexes,
        });
    } catch (error: any) {
        logger.error('Error fetching Datadog indexes:', { error, integrationId });
        res.status(500).json({
            error: "Failed to fetch indexes",
            details: error.message
        });
    }
};
