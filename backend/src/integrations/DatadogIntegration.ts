import { FormIntegrationInstallation, Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { DatadogIntegration, DatadogIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import { Request, Response } from "express";
import logger from "../logger";

// Map region to Datadog site configuration
function getDatadogSite(region: string): string {
    const regionMap: Record<string, string> = {
        'us': 'datadoghq.com',
        'eu': 'datadoghq.eu',
        'us3': 'us3.datadoghq.com',
        'us5': 'us5.datadoghq.com',
        'ap1': 'ap1.datadoghq.com',
    };
    return regionMap[region.toLowerCase()] || 'datadoghq.com';
}

// Get API base URL from region
function getDatadogApiUrl(region: string): string {
    const site = getDatadogSite(region);
    if (site === 'datadoghq.com') {
        return 'https://api.datadoghq.com';
    }
    return `https://api.${site}`;
}

export class DatadogIntegrationManager implements Integration<DatadogIntegration, never, typeof DatadogIntegrationMetadata>, FormIntegrationInstallation<IntegrationType.DATADOG> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.DATADOG;

    async getInstancesForUser(userId: string): Promise<DatadogIntegration[]> {
        const datadogIntegrations = await db().datadog_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                region: true,
            },
        });
        return datadogIntegrations.map(di => ({
            id: di.id,
            region: di.region,
        }));
    }

    async getAllActiveInstances(): Promise<DatadogIntegration[]> {
        const datadogIntegrations = await db().datadog_integrations.findMany({
            select: {
                id: true,
                region: true,
            },
        });
        return datadogIntegrations.map(di => ({
            id: di.id,
            region: di.region,
        }));
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // Datadog webhooks are handled elsewhere
        throw new Error("Datadog webhooks are not processed through this integration manager");
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {

    }

    async teardownChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {
    }

    async processFormSubmission(req: Request, res: Response): Promise<void> {
        if (!req.session?.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { apiKey, appKey, region } = req.body;

        if (!apiKey || typeof apiKey !== 'string') {
            res.status(400).json({ error: 'API key is required' });
            return;
        }

        if (!appKey || typeof appKey !== 'string') {
            res.status(400).json({ error: 'APP key is required' });
            return;
        }

        if (!region || typeof region !== 'string') {
            res.status(400).json({ error: 'Region is required' });
            return;
        }

        // Validate region
        const validRegions = ['us', 'eu', 'us3', 'us5', 'ap1'];
        if (!validRegions.includes(region.toLowerCase())) {
            res.status(400).json({ 
                error: 'Invalid region',
                details: `Region must be one of: ${validRegions.join(', ')}`
            });
            return;
        }

        try {
            // Validate API key and APP key by calling Datadog API
            const apiUrl = getDatadogApiUrl(region);
            const validationResponse = await fetch(`${apiUrl}/api/v1/validate`, {
                method: 'GET',
                headers: {
                    'DD-API-KEY': apiKey,
                    'DD-APPLICATION-KEY': appKey,
                    'Content-Type': 'application/json',
                },
            });

            if (!validationResponse.ok) {
                const errorText = await validationResponse.text();
                logger.error('Datadog API key validation failed', { 
                    status: validationResponse.status,
                    error: errorText,
                    region
                });
                res.status(400).json({ 
                    error: 'Invalid API key or APP key',
                    details: validationResponse.status === 403 ? 'Authentication failed' : 'API key validation failed'
                });
                return;
            }

            const userId = req.session.user.id;
            const normalizedRegion = region.toLowerCase();

            // Check if integration with the exact same credentials already exists for this user
            // This allows users to have multiple integrations with different API keys, APP keys, or regions
            const existing = await db().datadog_integrations.findFirst({
                where: { 
                    user_id: userId,
                    api_key: apiKey,
                    app_key: appKey,
                    region: normalizedRegion,
                },
            });

            if (existing) {
                // Update existing integration if exact same credentials
                await db().datadog_integrations.update({
                    where: { id: existing.id },
                    data: {
                        api_key: apiKey,
                        app_key: appKey,
                        region: normalizedRegion,
                    },
                });
                logger.info('✅ Updated Datadog integration', { 
                    integrationId: existing.id,
                    userId,
                    region: normalizedRegion
                });
            } else {
                // Create new integration - allows multiple integrations per user with different keys/regions
                const integration = await db().datadog_integrations.create({
                    data: {
                        user_id: userId,
                        api_key: apiKey,
                        app_key: appKey,
                        region: normalizedRegion,
                    },
                });
                logger.info('✅ Created Datadog integration', { 
                    integrationId: integration.id,
                    userId,
                    region: normalizedRegion
                });
            }

            res.status(200).json({ 
                success: true,
                region: normalizedRegion,
            });
        } catch (error) {
            logger.error('Error processing Datadog form submission', { error });
            res.status(500).json({ error: 'Failed to process integration' });
        }
    }
}
