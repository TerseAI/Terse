import { FormIntegrationInstallation, Integration, FormFieldDefinition, FormSubmissionInput, FormSubmissionResult } from "./abstract/Integration";
import { db } from "../prismaClient";
import { LaunchDarklyIntegration, LaunchDarklyIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import logger from "../logger";

export class LaunchDarklyIntegrationManager implements Integration<LaunchDarklyIntegration, never, typeof LaunchDarklyIntegrationMetadata>, FormIntegrationInstallation<IntegrationType.LAUNCHDARKLY> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.LAUNCHDARKLY;

    async getInstancesForUser(userId: string): Promise<LaunchDarklyIntegration[]> {
        const launchdarklyIntegrations = await db().launchdarkly_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                user_email: true,
                token_name: true,
            },
        });
        return launchdarklyIntegrations.map(li => ({
            id: li.id,
            email: li.user_email || null,
            tokenName: li.token_name || null,
        }));
    }

    formatIntegrationInstanceForAgent(instance: LaunchDarklyIntegration): string {
        const details: string[] = [];
        if (instance.tokenName) {
            details.push(`token "${instance.tokenName}"`);
        }
        if (instance.email) {
            details.push(`email ${instance.email}`);
        }
        const detailText = details.length ? ` (${details.join(", ")})` : "";
        return `LaunchDarkly${detailText} [id: ${instance.id}]`;
    }

    async getAllActiveInstances(): Promise<LaunchDarklyIntegration[]> {
        const launchdarklyIntegrations = await db().launchdarkly_integrations.findMany({
            select: {
                id: true,
                user_email: true,
                token_name: true,
            },
        });
        return launchdarklyIntegrations.map(li => ({
            id: li.id,
            email: li.user_email || null,
            tokenName: li.token_name || null,
        }));
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // LaunchDarkly webhooks are handled elsewhere
        throw new Error("LaunchDarkly webhooks are not processed through this integration manager");
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {

    }

    async teardownChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {
    }

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: 'apiKey',
                type: 'password',
                label: 'API Key',
                placeholder: 'Enter your LaunchDarkly API key',
                required: true,
                hint: 'Your LaunchDarkly API key (service token or access token). Find this in LaunchDarkly under Account Settings → Authorization → Tokens.',
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
            // Validate API key by calling LaunchDarkly API
            // Use /api/v2/projects endpoint which works for both service tokens and access tokens
            const validationResponse = await fetch('https://app.launchdarkly.com/api/v2/projects', {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            // Reject all non-2xx responses
            if (!validationResponse.ok) {
                const errorText = await validationResponse.text();
                logger.error('LaunchDarkly API key validation failed', { 
                    userId,
                    status: validationResponse.status,
                    error: errorText 
                });
                return {
                    success: false,
                    error: validationResponse.status === 401 ? 'Invalid API key' : 'API key validation failed',
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 401 ? 'Authentication failed' : `API returned status ${validationResponse.status}`
                    },
                };
            }

            // Token is valid (200)
            // Try to get token name from /api/v2/tokens endpoint
            let tokenName: string | null = null;
            try {
                const tokensResponse = await fetch('https://app.launchdarkly.com/api/v2/tokens', {
                    method: 'GET',
                    headers: {
                        'Authorization': apiKey,
                        'Content-Type': 'application/json',
                    },
                });

                if (tokensResponse.ok) {
                    const tokensData = await tokensResponse.json();
                    // Tokens response is typically an object with items array
                    const tokens = Array.isArray(tokensData) ? tokensData : (tokensData.items || tokensData.tokens || []);
                    
                    // Try to find the token by matching last 4 chars (only info we can get)
                    // Since we can't match by full value, we'll use the first token as a best guess
                    // or try to match by most recently used/created
                    if (tokens.length > 0) {
                        // Sort by lastUsed or creationDate descending to get most recent first
                        const sortedTokens = [...tokens].sort((a: any, b: any) => {
                            const aTime = a.lastUsed || a.creationDate || 0;
                            const bTime = b.lastUsed || b.creationDate || 0;
                            return bTime - aTime;
                        });
                        tokenName = sortedTokens[0]?.name || null;
                    }
                }
            } catch (tokenError) {
                logger.warn('Failed to fetch LaunchDarkly token info', { error: tokenError });
            }
            
            // Note: We don't extract email here since /projects doesn't return user info
            // Both service tokens and access tokens work with this endpoint
            const userEmail: string | null = null;

            // Check if integration already exists for this user
            const existing = await db().launchdarkly_integrations.findFirst({
                where: { user_id: userId },
            });

            if (existing) {
                // Update existing integration
                await db().launchdarkly_integrations.update({
                    where: { id: existing.id },
                    data: {
                        api_key: apiKey,
                        user_email: userEmail,
                        token_name: tokenName,
                    },
                });
                logger.info('✅ Updated LaunchDarkly integration', { 
                    integrationId: existing.id,
                    userId,
                    email: userEmail,
                    tokenName
                });
            } else {
                // Create new integration
                const integration = await db().launchdarkly_integrations.create({
                    data: {
                        user_id: userId,
                        api_key: apiKey,
                        user_email: userEmail,
                        token_name: tokenName,
                    },
                });
                logger.info('✅ Created LaunchDarkly integration', { 
                    integrationId: integration.id,
                    userId,
                    email: userEmail,
                    tokenName
                });
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    email: userEmail,
                    tokenName: tokenName,
                },
            };
        } catch (error) {
            logger.error('Error processing LaunchDarkly form submission', { error });
            return {
                success: false,
                error: 'Failed to process integration',
                statusCode: 500,
            };
        }
    }

}
