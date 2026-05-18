import { IntegrationType } from "terse-types"
import { User } from "terse-types"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { SecretService } from "../../services/SecretService"

/**
 * Get PostHog API key by integration ID
 * Validates that the integration belongs to the user
 */
export async function getPosthogApiKeyByIntegrationId(integrationId: string, user: User): Promise<string | null> {
    const integration = await db().posthog_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("PostHog integration not found", { integrationId, organizationId: user.organizationId })
        return null
    }

    if (integration.organization_id !== user.organizationId) {
        logger.warn("PostHog integration does not belong to user", { integrationId, organizationId: user.organizationId, tokenOrganizationId: integration.organization_id })
        return null
    }

    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.POSTHOG, recordId: integration.id } })
    return secrets?.apiKey ?? null
}
