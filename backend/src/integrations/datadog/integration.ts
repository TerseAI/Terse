import { FormFieldDefinition, FormIntegrationSetup } from "terse-types"
import { DatadogIntegration, DatadogIntegrationMetadata, IntegrationType } from "terse-types/Integrations"
import { z } from "zod"

import logger from "../../common/logger"
import { getDatadogApiUrl } from "../../integrations/datadog/helpers"
import { db } from "../../loaders/prisma"
import { getDatadogCredentialsByIntegrationId } from "../../outputs/datadog/datadogApiClient"
import { AgentTriggerWithConfigs } from "../../types/prisma"

import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

export class DatadogIntegrationManager extends Integration<DatadogIntegration, never, typeof DatadogIntegrationMetadata, never> implements FormIntegrationInstallation<IntegrationType.DATADOG> {
    readonly integrationType = IntegrationType.DATADOG
    readonly secretSchema = z.object({
        apiKey: z.string(),
        appKey: z.string()
    })

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

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Create Datadog API and Application Keys",
            url: "https://docs.datadoghq.com/account_management/api-app-keys/",
            instructions: [
                "Create an API key and an Application key.",
                "The Application key must include `logs_read_data`, `logs_read_index_data`, and `rum_apps_read`.",
                "Use the Datadog site that matches the region you enter here."
            ]
        }
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

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integration = await db().datadog_integrations.findFirst({
            where: { organization_id: organizationId },
            orderBy: { created_at: "asc" }
        })

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Region", integration.region, integration.id)
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
        return db()
            .$transaction(async tx => {
                await tx.datadog_integrations.delete({ where: { id: integrationId } })
            })
            .then(async () => {
                await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.DATADOG, recordId: integrationId } })
            })
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
                await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.DATADOG, recordId: existing.id, value: { apiKey: apiKey, appKey: appKey } } })

                await db().datadog_integrations.update({
                    where: { id: existing.id },
                    data: {
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
                        region: normalizedRegion
                    }
                })

                await this.secretService.createSecrets({
                    type: "integration",
                    secret: { integrationType: IntegrationType.DATADOG, recordId: integration.id, value: { apiKey: apiKey, appKey: appKey } }
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

    return getDatadogCredentialsByIntegrationId(datadogIntegration.id)
}

/**
 * Verifies that the given Datadog log indexes exist and are accessible with the integration's credentials.
 */
export async function validateDatadogIndexesExist(integrationId: string, indexes: string[]): Promise<void> {
    if (!indexes.length) return
    const credentials = await getDatadogCredentialsByIntegrationId(integrationId)
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
