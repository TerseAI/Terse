import { Request, Response } from "express"
import { InstallationOptionsFor, IntegrationDetails, IntegrationInstance, IntegrationType, IntegrationWithStatus } from "terse-types/Integrations"
import { OAuthInstallationDetails } from "terse-types/types"

import logger from "../../common/logger"
import { Integration, isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import { decodeOAuthStateToken } from "../../modules/auth/helpers/oauth"

export class IntegrationNotFoundError extends Error {
    constructor(integrationType: string) {
        super(`Integration '${integrationType}' not found`)
        this.name = "IntegrationNotFoundError"
    }
}

export class IntegrationNotConnectedError extends Error {
    constructor(integrationType: string) {
        super(`Integration '${integrationType}' is not connected`)
        this.name = "IntegrationNotConnectedError"
    }
}

export class IntegrationInstallationUnsupportedError extends Error {
    constructor(integration: string) {
        super(`Integration ${integration} does not support installation`)
        this.name = "IntegrationInstallationUnsupportedError"
    }
}

function findIntegration(integrationType: string) {
    return INTEGRATION_REGISTRY.find(instance => instance.integrationType === integrationType)
}

export function decodeOptionalStatePayload(stateToken: string | undefined, fallbackIntegrationType: string, userId: string | undefined): Record<string, string> | undefined {
    if (!stateToken) return undefined
    try {
        const statePayload = decodeOAuthStateToken(stateToken)
        if (statePayload.chatId && statePayload.channel) {
            return {
                chatId: statePayload.chatId,
                channel: statePayload.channel,
                integrationType: statePayload.integrationType || fallbackIntegrationType,
                ...(statePayload.messageTs ? { messageTs: statePayload.messageTs } : {})
            }
        }
    } catch (error) {
        logger.warn("Failed to decode stateToken in getIntegrationInstallationDetails", { error, integrationType: fallbackIntegrationType, userId })
    }
    return undefined
}

export async function getInstallationInformation(
    integration: IntegrationType,
    userId: string,
    organizationId: string,
    options: InstallationOptionsFor<IntegrationType>,
    additionalStatePayload: Record<string, string> | undefined,
    req: Request,
    res: Response
): Promise<OAuthInstallationDetails> {
    const integrationInstance = findIntegration(integration)
    if (!integrationInstance) throw new IntegrationNotFoundError(integration)
    if (isOAuthIntegrationInstallation<typeof integration>(integrationInstance)) {
        return integrationInstance.getInstallationUrl(userId, organizationId, options, additionalStatePayload, req, res)
    }
    throw new IntegrationInstallationUnsupportedError(integration)
}

export async function listIntegrationsForOrganization(organizationId: string): Promise<IntegrationWithStatus[]> {
    return Promise.all(
        INTEGRATION_REGISTRY.map(async integration => {
            const cliDisplayState = await integration.getCliDisplayStateForOrganization(organizationId)
            return {
                integrationType: integration.integrationType,
                isActive: cliDisplayState.status === "connected",
                cliDisplayState
            }
        })
    )
}

export async function disconnectIntegrationForOrganization(integrationType: string, organizationId: string): Promise<void> {
    const integration = findIntegration(integrationType)
    if (!integration) throw new IntegrationNotFoundError(integrationType)

    const cliDisplayState = await integration.getCliDisplayStateForOrganization(organizationId)
    if (cliDisplayState.status !== "connected") throw new IntegrationNotConnectedError(integrationType)

    await integration.deleteInstallation(cliDisplayState.integrationId)
}

async function integrationHasInstances(integration: Integration<IntegrationInstance, unknown, IntegrationDetails, unknown>, organizationId: string): Promise<boolean> {
    return (await integration.getInstancesForOrganization(organizationId)).length > 0
}

export async function listActiveIntegrationsForOrganization(organizationId: string): Promise<IntegrationType[]> {
    const hasInstancesResults = await Promise.all(
        INTEGRATION_REGISTRY.map(integration => integrationHasInstances(integration as Integration<IntegrationInstance, unknown, IntegrationDetails, unknown>, organizationId))
    )
    return INTEGRATION_REGISTRY.filter((_, index) => hasInstancesResults[index]).map(integration => integration.integrationType)
}
