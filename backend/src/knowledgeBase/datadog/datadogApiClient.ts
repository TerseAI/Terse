import logger from '../../logger';
import { db } from '../../prismaClient';

/**
 * Get Datadog credentials by integration ID
 * Validates that the integration belongs to the user
 */
export async function getDatadogCredentialsByIntegrationId(integrationId: string, userId: string): Promise<{ apiKey: string, appKey: string, region: string } | null> {
    const integration = await db().datadog_integrations.findUnique({
        where: { id: integrationId },
    });

    if (!integration) {
        logger.warn('Datadog integration not found', { integrationId, userId });
        return null;
    }

    if (integration.user_id !== userId) {
        logger.warn('Datadog integration does not belong to user', { integrationId, userId, tokenUserId: integration.user_id });
        return null;
    }

    return {
        apiKey: integration.api_key,
        appKey: integration.app_key,
        region: integration.region,
    };
}
