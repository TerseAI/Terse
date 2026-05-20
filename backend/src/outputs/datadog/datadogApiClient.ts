import { IntegrationType } from "terse-types"

import { db } from "../../prismaClient"
import { SecretService } from "../../services/SecretService"

export async function getDatadogCredentialsByIntegrationId(integrationId: string): Promise<{ apiKey: string; appKey: string; region: string }> {
    const integration = await db().datadog_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        throw new Error(`Datadog integration ${integrationId} not found`)
    }

    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.DATADOG, recordId: integration.id }
    })

    return {
        apiKey: secrets.apiKey,
        appKey: secrets.appKey,
        region: integration.region
    }
}
