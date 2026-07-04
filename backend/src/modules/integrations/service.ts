import { Request, Response } from "express"
import { InstallationOptionsFor, InstallationOptionsSchemas, IntegrationDetails, IntegrationInstance, IntegrationType, IntegrationWithStatus } from "terse-types/Integrations"
import { OAuthInstallationDetails } from "terse-types/types"

import logger from "../../common/logger"
import { Integration, isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { IntegrationRegistry } from "../../integrations/abstract/IntegrationRegistry"
import { decodeOAuthStateToken } from "../../modules/auth/helpers/oauth"

import { MissingIntegrationOptionsError } from "./errors"

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

export { MissingIntegrationOptionsError } from "./errors"

function findIntegration(integrationType: string) {
    return IntegrationRegistry.getInstance()
        .all()
        .find(instance => instance.integrationType === integrationType)
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
    options: unknown,
    additionalStatePayload: Record<string, string> | undefined,
    req: Request,
    res: Response
): Promise<OAuthInstallationDetails> {
    const integrationInstance = findIntegration(integration)
    if (!integrationInstance) throw new IntegrationNotFoundError(integration)
    if (!isOAuthIntegrationInstallation<typeof integration>(integrationInstance)) {
        throw new IntegrationInstallationUnsupportedError(integration)
    }

    const parsedOptions = parseInstallationOptionsOrThrow(integration, options)
    return integrationInstance.getInstallationUrl(userId, organizationId, parsedOptions, additionalStatePayload, req, res)
}

function parseInstallationOptionsOrThrow<T extends IntegrationType>(integration: T, options: unknown): InstallationOptionsFor<T> {
    const schema = InstallationOptionsSchemas[integration]
    const result = schema.safeParse(options ?? {})
    if (!result.success) {
        const missingFields = result.error.issues.map(issue => issue.path.join(".")).filter(Boolean)
        throw new MissingIntegrationOptionsError(integration, missingFields.length > 0 ? missingFields : ["<unknown>"])
    }
    return result.data as InstallationOptionsFor<T>
}

export async function listIntegrationsForOrganization(organizationId: string): Promise<IntegrationWithStatus[]> {
    return Promise.all(
        IntegrationRegistry.getInstance()
            .all()
            .map(async integration => {
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
        IntegrationRegistry.getInstance()
            .all()
            .map(integration => integrationHasInstances(integration as Integration<IntegrationInstance, unknown, IntegrationDetails, unknown>, organizationId))
    )
    return IntegrationRegistry.getInstance()
        .all()
        .filter((_, index) => hasInstancesResults[index])
        .map(integration => integration.integrationType)
}
