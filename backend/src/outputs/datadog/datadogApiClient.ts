import { IntegrationType } from "terse-types"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { getSecrets } from "../../services/SecretService"

export async function getDatadogCredentialsByIntegrationId(integrationId: string): Promise<{ apiKey: string; appKey: string; region: string } | null> {
    const integration = await db().datadog_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("Datadog integration not found", { integrationId })
        return null
    }

    const secrets = await getSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.DATADOG, recordId: integration.id }
    })
    if (!secrets) {
        logger.warn("Datadog integration is missing API key or app key", { integrationId })
        return null
    }

    return {
        apiKey: secrets.apiKey,
        appKey: secrets.appKey,
        region: integration.region
    }
}
