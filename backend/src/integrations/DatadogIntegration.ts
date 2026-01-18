import { FormFieldDefinition, FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { DatadogIntegration, DatadogIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import logger from "../logger";
import { getDatadogApiUrl } from "../utility/datadog";

export class DatadogIntegrationManager implements Integration<DatadogIntegration, never, typeof DatadogIntegrationMetadata>, FormIntegrationInstallation<IntegrationType.DATADOG> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.DATADOG;

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: 'apiKey',
                type: 'password',
                label: 'API Key',
                placeholder: 'Enter your Datadog API key',
                required: true,
                hint: 'Find this in Datadog under Organization Settings → API Keys.',
            },
            {
                name: 'appKey',
                type: 'password',
                label: 'Application Key',
                placeholder: 'Enter your Datadog application key',
                required: true,
                hint: 'Find this in Datadog under Organization Settings → Application Keys.',
            },
            {
                name: 'region',
                type: 'text',
                label: 'Region',
                placeholder: 'us, eu, us3, us5, ap1',
                required: true,
                hint: 'Use the Datadog site region where your account lives.',
            },
        ];
    }

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

    formatIntegrationInstanceForAgent(instance: DatadogIntegration): string {
        const regionLabel = instance.region ? ` (${instance.region})` : "";
        return `Datadog${regionLabel} [id: ${instance.id}]`;
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

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, formValues } = input;
        const { apiKey, appKey, region } = formValues;

        if (!apiKey || typeof apiKey !== 'string') {
            return {
                success: false,
                error: 'API key is required',
                statusCode: 400,
            };
        }

        if (!appKey || typeof appKey !== 'string') {
            return {
                success: false,
                error: 'APP key is required',
                statusCode: 400,
            };
        }

        if (!region || typeof region !== 'string') {
            return {
                success: false,
                error: 'Region is required',
                statusCode: 400,
            };
        }

        // Validate region
        const validRegions = ['us', 'eu', 'us3', 'us5', 'ap1'];
        if (!validRegions.includes(region.toLowerCase())) {
            return {
                success: false,
                error: 'Invalid region',
                statusCode: 400,
                data: {
                    details: `Region must be one of: ${validRegions.join(', ')}`
                },
            };
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
                return {
                    success: false,
                    error: 'Invalid API key or APP key',
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 403 ? 'Authentication failed' : 'API key validation failed'
                    },
                };
            }
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

            return {
                success: true,
                statusCode: 200,
                data: {
                    region: normalizedRegion,
                },
            };
        } catch (error) {
            logger.error('Error processing Datadog form submission', { error });
            return {
                success: false,
                error: 'Failed to process integration',
                statusCode: 500,
            };
        }
    }
}
