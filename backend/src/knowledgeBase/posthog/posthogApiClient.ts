import logger from '../../logger';
import { db } from '../../prismaClient';

/**
 * Get PostHog API key by integration ID
 * Validates that the integration belongs to the user
 */
export async function getPosthogApiKeyByIntegrationId(integrationId: string, userId: string): Promise<string | null> {
    const integration = await db().posthog_integrations.findUnique({
        where: { id: integrationId },
    });

    if (!integration) {
        logger.warn('PostHog integration not found', { integrationId, userId });
        return null;
    }

    if (integration.user_id !== userId) {
        logger.warn('PostHog integration does not belong to user', { integrationId, userId, tokenUserId: integration.user_id });
        return null;
    }

    return integration.api_key;
}
