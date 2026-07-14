import { IntegrationType } from "terse-types"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { SecretService } from "../../services/SecretService"

export async function getResendApiKeyByIntegrationId(integrationId: string, user: UserSession): Promise<string | null> {
    const integration = await db().resend_integrations.findUnique({ where: { id: integrationId } })
    if (!integration || integration.organization_id !== user.organizationId) {
        logger.warn("Resend integration not found or access denied", { integrationId, organizationId: user.organizationId })
        return null
    }
    const secrets = await SecretService.getInstance().tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.RESEND, recordId: integrationId } })
    return secrets?.apiKey ?? null
}
