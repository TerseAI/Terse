import logger from "../../logger"
import { db } from "../../prismaClient"
import { User } from "../../shared/types"

/**
 * Get Datadog credentials by integration ID
 * Validates that the integration belongs to the user
 */
export async function getDatadogCredentialsByIntegrationId(integrationId: string, user: User): Promise<{ apiKey: string; appKey: string; region: string } | null> {
    const integration = await db().datadog_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("Datadog integration not found", { integrationId, organizationId: user.organizationId })
        return null
    }

    if (integration.organization_id !== user.organizationId) {
        logger.warn("Datadog integration does not belong to user", { integrationId, organizationId: user.organizationId, tokenOrganizationId: integration.organization_id })
        return null
    }

    return {
        apiKey: integration.api_key,
        appKey: integration.app_key,
        region: integration.region
    }
}
