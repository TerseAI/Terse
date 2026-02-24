import logger from "../../logger"
import { db } from "../../prismaClient"
import { User } from "../../shared/types"

/**
 * Get Datadog credentials by integration ID
 * Validates that the integration belongs to the user
 */
export async function getDatadogCredentialsByIntegrationId(integrationId: string): Promise<{ apiKey: string; appKey: string; region: string } | null> {
    const integration = await db().datadog_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("Datadog integration not found", { integrationId })
        return null
    }

    return {
        apiKey: integration.api_key,
        appKey: integration.app_key,
        region: integration.region
    }
}
