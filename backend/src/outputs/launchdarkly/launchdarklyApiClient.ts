import logger from "../../logger"
import { db } from "../../prismaClient"
import { User } from "../../shared/types"

/**
 * Get LaunchDarkly API key by integration ID
 * Validates that the integration belongs to the user
 */
export async function getLaunchDarklyApiKeyByIntegrationId(integrationId: string, user: User): Promise<string | null> {
    const integration = await db().launchdarkly_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("LaunchDarkly integration not found", { integrationId, organizationId: user.organizationId })
        return null
    }

    if (integration.organization_id !== user.organizationId) {
        logger.warn("LaunchDarkly integration does not belong to user", { integrationId, organizationId: user.organizationId, tokenOrganizationId: integration.organization_id })
        return null
    }

    return integration.api_key
}
