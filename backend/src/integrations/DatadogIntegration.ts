import logger from "../logger"
import { getDatadogCredentialsByIntegrationId } from "../outputs/datadog/datadogApiClient"
import { db } from "../prismaClient"
import { DatadogIntegration, DatadogIntegrationMetadata, IntegrationType } from "../shared/Integrations"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { getDatadogApiUrl } from "../utility/datadog"

import { FormFieldDefinition, FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration } from "./abstract/Integration"

export class DatadogIntegrationManager implements Integration<DatadogIntegration, never, typeof DatadogIntegrationMetadata, never>, FormIntegrationInstallation<IntegrationType.DATADOG> {
    constructor() {}
    integrationType: IntegrationType = IntegrationType.DATADOG

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "apiKey",
                type: "password",
                label: "API Key",
                placeholder: "Enter your Datadog API key",
                required: true,
                hint: "Find this in Datadog under Organization Settings → API Keys."
            },
            {
                name: "appKey",
                type: "password",
                label: "Application Key",
                placeholder: "Enter your Datadog application key",
                required: true,
                hint: "Find this in Datadog under Organization Settings → Application Keys."
            },
            {
                name: "region",
                type: "text",
                label: "Region",
                placeholder: "us, eu, us3, us5, ap1",
                required: true,
                hint: "Use the Datadog site region where your account lives."
            }
        ]
    }

    async getInstancesForOrganization(organizationId: string): Promise<DatadogIntegration[]> {
        const datadogIntegrations = await db().datadog_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                region: true
            }
        })
        return datadogIntegrations.map(di => ({
            id: di.id,
            region: di.region
        }))
    }

    formatIntegrationInstanceForAgent(instance: DatadogIntegration): string {
        const regionLabel = instance.region ? ` (${instance.region})` : ""
        return `Datadog${regionLabel} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<DatadogIntegration[]> {
        const datadogIntegrations = await db().datadog_integrations.findMany({
            select: {
                id: true,
                region: true
            }
        })
        return datadogIntegrations.map(di => ({
            id: di.id,
            region: di.region
        }))
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // Datadog webhooks are handled elsewhere
        throw new Error("Datadog webhooks are not processed through this integration manager")
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
    }

    async setupAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {}

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {}

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, organizationId, formValues } = input
        const { apiKey, appKey, region } = formValues

        if (!apiKey || typeof apiKey !== "string") {
            return {
                success: false,
                error: "API key is required",
                statusCode: 400
            }
        }

        if (!appKey || typeof appKey !== "string") {
            return {
                success: false,
                error: "APP key is required",
                statusCode: 400
            }
        }

        if (!region || typeof region !== "string") {
            return {
                success: false,
                error: "Region is required",
                statusCode: 400
            }
        }

        // Validate region
        const validRegions = ["us", "eu", "us3", "us5", "ap1"]
        if (!validRegions.includes(region.toLowerCase())) {
            return {
                success: false,
                error: "Invalid region",
                statusCode: 400,
                data: {
                    details: `Region must be one of: ${validRegions.join(", ")}`
                }
            }
        }

        try {
            // Validate API key and APP key by calling Datadog API
            const apiUrl = getDatadogApiUrl(region)
            const validationResponse = await fetch(`${apiUrl}/api/v1/validate`, {
                method: "GET",
                headers: {
                    "DD-API-KEY": apiKey,
                    "DD-APPLICATION-KEY": appKey,
                    "Content-Type": "application/json"
                }
            })

            if (!validationResponse.ok) {
                const errorText = await validationResponse.text()
                logger.error("Datadog API key validation failed", {
                    status: validationResponse.status,
                    error: errorText,
                    region
                })
                return {
                    success: false,
                    error: "Invalid API key or APP key",
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 403 ? "Authentication failed" : "API key validation failed"
                    }
                }
            }
            const normalizedRegion = region.toLowerCase()

            // Check if integration already exists for this organization
            const existing = await db().datadog_integrations.findFirst({
                where: {
                    organization_id: organizationId
                }
            })

            if (existing) {
                // Update existing integration with new credentials
                await db().datadog_integrations.update({
                    where: { id: existing.id },
                    data: {
                        api_key: apiKey,
                        app_key: appKey,
                        region: normalizedRegion,
                        organization_id: organizationId
                    }
                })
                logger.info("✅ Updated Datadog integration", {
                    integrationId: existing.id,
                    userId,
                    region: normalizedRegion
                })
            } else {
                // Create new integration
                const integration = await db().datadog_integrations.create({
                    data: {
                        user_id: userId,
                        organization_id: organizationId,
                        api_key: apiKey,
                        app_key: appKey,
                        region: normalizedRegion
                    }
                })
                logger.info("✅ Created Datadog integration", {
                    integrationId: integration.id,
                    userId,
                    region: normalizedRegion
                })
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    region: normalizedRegion
                }
            }
        } catch (error) {
            logger.error("Error processing Datadog form submission", { error })
            return {
                success: false,
                error: "Failed to process integration",
                statusCode: 500
            }
        }
    }
}

export async function getDatadogCredentialsForOrganization(integrationId: string, organizationId: string): Promise<{ apiKey: string; appKey: string; region: string }> {
    const datadogIntegration = await db().datadog_integrations.findUnique({
        where: { id: integrationId, organization_id: organizationId }
    })
    if (!datadogIntegration) {
        throw new Error(`Datadog integration not found for integrationId: ${integrationId}`)
    }

    const credentials = await getDatadogCredentialsByIntegrationId(datadogIntegration.id)
    if (!credentials) {
        throw new Error(`Datadog integration not found or access denied for integrationId: ${integrationId}`)
    }

    return credentials
}

/**
 * Verifies that the given Datadog log indexes exist and are accessible with the integration's credentials.
 */
export async function validateDatadogIndexesExist(integrationId: string, indexes: string[]): Promise<void> {
    if (!indexes.length) return
    const credentials = await getDatadogCredentialsByIntegrationId(integrationId)
    if (!credentials) {
        throw new Error(`Datadog integration ${integrationId} not found or access denied`)
    }
    const apiUrl = getDatadogApiUrl(credentials.region)
    const response = await fetch(`${apiUrl}/api/v1/logs/config/indexes`, {
        method: "GET",
        headers: {
            "DD-API-KEY": credentials.apiKey,
            "DD-APPLICATION-KEY": credentials.appKey,
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`Datadog indexes not accessible`, { status: response.status, errorText })
        throw new Error(`Datadog indexes not accessible`)
    }
    const data = await response.json()
    const indexList = Array.isArray(data) ? data : data.indexes || data.data || []
    const validNames = new Set(indexList.map((idx: { name?: string; id?: string }) => idx.name || idx.id))
    const missing = indexes.filter(name => !validNames.has(name))
    if (missing.length > 0) {
        throw new Error(`Datadog log index(es) not found: ${missing.join(", ")}`)
    }
}
