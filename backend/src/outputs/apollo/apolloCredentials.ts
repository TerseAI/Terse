import { IntegrationType } from "terse-types"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { SecretService } from "../../services/SecretService"

export async function getApolloApiKeyByIntegrationId(integrationId: string, user: UserSession): Promise<string | null> {
    const integration = await db().apollo_integrations.findUnique({ where: { id: integrationId } })
    if (!integration || integration.organization_id !== user.organizationId) {
        logger.warn("Apollo integration not found or access denied", { integrationId, organizationId: user.organizationId })
        return null
    }
    const secrets = await SecretService.getInstance().tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.APOLLO, recordId: integrationId } })
    return secrets?.apiKey ?? null
}

export async function requireApolloApiKey(integrationId: string, user: UserSession): Promise<string> {
    const apiKey = await getApolloApiKeyByIntegrationId(integrationId, user)
    if (!apiKey) {
        throw new Error(`Apollo integration not found or access denied for integrationId: ${integrationId}`)
    }
    return apiKey
}
