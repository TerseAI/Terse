import { FormIntegrationInstallation, Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { DatadogIntegration, DatadogIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import { Request, Response } from "express";
import logger from "../logger";
import { getDatadogApiUrl } from "../utility/datadog";

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

            // Check if integration already exists for this user
            const existing = await db().datadog_integrations.findFirst({
                where: { 
                    user_id: userId,
                },
            });

            if (existing) {
                // Update existing integration with new credentials
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
                // Create new integration
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
