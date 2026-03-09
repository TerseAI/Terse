import logger from "../../logger"
import { db } from "../../prismaClient"
import { getSecret } from "../../services/SecretService"

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

    const apiKey = await getSecret("datadog_integrations", integration.id, "api_key")
    const appKey = await getSecret("datadog_integrations", integration.id, "app_key")

    if (!apiKey || !appKey) {
        logger.warn("Datadog integration is missing API key or app key", { integrationId })
        return null
    }

    return {
        apiKey,
        appKey,
        region: integration.region
    }
}
