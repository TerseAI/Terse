import { IntegrationType } from "terse-types"
import { User } from "terse-types"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { SecretService } from "../../services/SecretService"

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

    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.LAUNCHDARKLY, recordId: integration.id } })
    return secrets?.apiKey ?? null
}
