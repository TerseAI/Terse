import { IntegrationType } from "terse-types"

import { db } from "../../prismaClient"
import { getSecrets } from "../../services/SecretService"

export async function getDatadogCredentialsByIntegrationId(integrationId: string): Promise<{ apiKey: string; appKey: string; region: string }> {
    const integration = await db().datadog_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        throw new Error(`Datadog integration ${integrationId} not found`)
    }

    const secrets = await getSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.DATADOG, recordId: integration.id }
    })

    return {
        apiKey: secrets.apiKey,
        appKey: secrets.appKey,
        region: integration.region
    }
}
