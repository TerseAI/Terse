import { FormIntegrationInstallation, FormFieldDefinition, Integration, FormSubmissionInput, FormSubmissionResult } from "./abstract/Integration";
import { db } from "../prismaClient";
import { PosthogIntegration, PosthogIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { AgentInputWithConfigs } from "../types/prisma";
import logger from "../logger";

export class PosthogIntegrationManager implements Integration<PosthogIntegration, never, typeof PosthogIntegrationMetadata>, FormIntegrationInstallation<IntegrationType.POSTHOG> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.POSTHOG;

    async getInstancesForUser(userId: string): Promise<PosthogIntegration[]> {
        const posthogIntegrations = await db().posthog_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                user_email: true,
                org_name: true,
            },
        });
        return posthogIntegrations.map(ni => ({
            id: ni.id,
            email: ni.user_email || null,
            orgName: ni.org_name || null,
        }));
    }

    formatIntegrationInstanceForAgent(instance: PosthogIntegration): string {
        const details: string[] = [];
        if (instance.orgName) {
            details.push(`org "${instance.orgName}"`);
        }
        if (instance.email) {
            details.push(`email ${instance.email}`);
        }
        const detailText = details.length ? ` (${details.join(", ")})` : "";
        return `Posthog${detailText} [id: ${instance.id}]`;
    }

    async getAllActiveInstances(): Promise<PosthogIntegration[]> {
        const posthogIntegrations = await db().posthog_integrations.findMany({
            select: {
                id: true,
                user_email: true,
                org_name: true,
            },
        });
        return posthogIntegrations.map(pi => ({
            id: pi.id,
            email: pi.user_email || null,
            orgName: pi.org_name || null,
        }));
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // Posthog webhooks are handled elsewhere
        throw new Error("Posthog webhooks are not processed through this integration manager");
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupAgentInput(integrationId: string, agentInput: AgentInputWithConfigs): Promise<void> {

    }

    async teardownAgentInput(integrationId: string, agentInput: AgentInputWithConfigs): Promise<void> {
    }

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: 'apiKey',
                type: 'password',
                label: 'API Key',
                placeholder: 'Enter your PostHog API key',
                required: true,
                hint: 'Your PostHog API key can be found in your PostHog account settings.',
            },
        ];
    }

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, formValues } = input;
        const { apiKey } = formValues;

        if (!apiKey || typeof apiKey !== 'string') {
            return {
                success: false,
                error: 'API key is required',
                statusCode: 400,
            };
        }

        try {
            // Validate API key by calling Posthog API
            const validationResponse = await fetch('https://us.posthog.com/api/users/@me/', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!validationResponse.ok) {
                const errorText = await validationResponse.text();
                logger.error('Posthog API key validation failed', { 
                    status: validationResponse.status,
                    error: errorText 
                });
                return {
                    success: false,
                    error: 'Invalid API key',
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 401 ? 'Authentication failed' : 'API key validation failed'
                    }
                };
            }

            const userData = await validationResponse.json();
            
            // Extract email and org from response
            // Posthog API structure: response may have email directly or nested
            // Organization may be in organization.name, organization_name, or similar
            const userEmail = userData.email || userData.user?.email || userData.user_email || null;
            const orgName = userData.organization?.name || userData.organization_name || userData.org_name || userData.organization?.organization_name || null;

            // Check if integration already exists for this user
            const existing = await db().posthog_integrations.findFirst({
                where: { user_id: userId },
            });

            if (existing) {
                // Update existing integration
                await db().posthog_integrations.update({
                    where: { id: existing.id },
                    data: {
                        api_key: apiKey,
                        user_email: userEmail,
                        org_name: orgName,
                    },
                });
                logger.info('✅ Updated Posthog integration', { 
                    integrationId: existing.id,
                    userId,
                    email: userEmail 
                });
            } else {
                // Create new integration
                const integration = await db().posthog_integrations.create({
                    data: {
                        user_id: userId,
                        api_key: apiKey,
                        user_email: userEmail,
                        org_name: orgName,
                    },
                });
                logger.info('✅ Created Posthog integration', { 
                    integrationId: integration.id,
                    userId,
                    email: userEmail 
                });
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    email: userEmail,
                    orgName: orgName,
                },
            };
        } catch (error) {
            logger.error('Error processing Posthog form submission', { error });
            return {
                success: false,
                error: 'Failed to process integration',
                statusCode: 500,
            };
        }
    }

}