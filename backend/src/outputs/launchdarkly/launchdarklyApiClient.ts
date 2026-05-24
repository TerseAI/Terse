import { IntegrationType } from "terse-types"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { SecretService } from "../../services/SecretService"

/**
 * Get LaunchDarkly API key by integration ID
 * Validates that the integration belongs to the user
 */
export async function getLaunchDarklyApiKeyByIntegrationId(integrationId: string, user: UserSession): Promise<string | null> {
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
    const secrets = await secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.LAUNCHDARKLY, recordId: integration.id } })
    return secrets?.apiKey ?? null
}
