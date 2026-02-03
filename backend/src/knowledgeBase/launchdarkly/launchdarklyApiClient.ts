import logger from "../../logger"
import { db } from "../../prismaClient"

/**
 * Get LaunchDarkly API key by integration ID
 * Validates that the integration belongs to the user
 */
export async function getLaunchDarklyApiKeyByIntegrationId(integrationId: string, userId: string): Promise<string | null> {
    const integration = await db().launchdarkly_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("LaunchDarkly integration not found", { integrationId, userId })
        return null
    }

    if (integration.user_id !== userId) {
        logger.warn("LaunchDarkly integration does not belong to user", { integrationId, userId, tokenUserId: integration.user_id })
        return null
    }

    return integration.api_key
}
