import logger from "../logger"
import { db } from "../prismaClient"
import { fetchPosthogProjects } from "../routes/posthog"
import { IntegrationType, PosthogIntegration, PosthogIntegrationMetadata } from "../shared/Integrations"
import { PosthogProject } from "../shared/types"
import { AgentTriggerWithConfigs } from "../types/prisma"

import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { FormFieldDefinition, FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, IntegrationWithResources } from "./abstract/Integration"

export class PosthogIntegrationManager implements Integration<PosthogIntegration, never, typeof PosthogIntegrationMetadata, PosthogProject>, FormIntegrationInstallation<IntegrationType.POSTHOG> {
    constructor() {}
    integrationType: IntegrationType = IntegrationType.POSTHOG

    async getInstancesForOrganization(organizationId: string): Promise<PosthogIntegration[]> {
        const posthogIntegrations = await db().posthog_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                user_email: true,
                org_name: true
            }
        })
        return posthogIntegrations.map(pi => ({
            id: pi.id,
            email: pi.user_email || null,
            orgName: pi.org_name || null
        }))
    }

    async fetchResourcesForOrganization(organizationId: string, query?: string, _options?: FetchResourcesOptions): Promise<IntegrationWithResources<PosthogIntegration, PosthogProject>[]> {
        const integrations = await this.getInstancesForOrganization(organizationId)
        return Promise.all(
            integrations.map(async integration => {
                try {
                    const response = await fetchPosthogProjects(organizationId, integration.id, query ?? "")
                    const projects = response.projects ?? response
                    return {
                        integration,
                        resources: Array.isArray(projects) ? projects : []
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for Posthog integration ${integration.id}`, { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: PosthogIntegration): string {
        const details: string[] = []
        if (instance.orgName) {
            details.push(`org "${instance.orgName}"`)
        }
        if (instance.email) {
            details.push(`email ${instance.email}`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Posthog${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<PosthogIntegration[]> {
        const posthogIntegrations = await db().posthog_integrations.findMany({
            select: {
                id: true,
                user_email: true,
                org_name: true
            }
        })
        return posthogIntegrations.map(pi => ({
            id: pi.id,
            email: pi.user_email || null,
            orgName: pi.org_name || null
        }))
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // Posthog webhooks are handled elsewhere
        throw new Error("Posthog webhooks are not processed through this integration manager")
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
    }

    async setupAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {}

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {}

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "apiKey",
                type: "password",
                label: "API Key",
                placeholder: "Enter your PostHog API key",
                required: true,
                hint: "Your PostHog API key can be found in your PostHog account settings."
            }
        ]
    }

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, organizationId, formValues } = input
        const { apiKey } = formValues

        if (!apiKey || typeof apiKey !== "string") {
            return {
                success: false,
                error: "API key is required",
                statusCode: 400
            }
        }

        try {
            // Validate API key by calling Posthog API
            const validationResponse = await fetch("https://us.posthog.com/api/users/@me/", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            })

            if (!validationResponse.ok) {
                const errorText = await validationResponse.text()
                logger.error("Posthog API key validation failed", {
                    status: validationResponse.status,
                    error: errorText
                })
                return {
                    success: false,
                    error: "Invalid API key",
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 401 ? "Authentication failed" : "API key validation failed"
                    }
                }
            }

            const userData = await validationResponse.json()

            // Extract email and org from response
            // Posthog API structure: response may have email directly or nested
            // Organization may be in organization.name, organization_name, or similar
            const userEmail = userData.email || userData.user?.email || userData.user_email || null
            const orgName = userData.organization?.name || userData.organization_name || userData.org_name || userData.organization?.organization_name || null

            // Check if integration already exists for this organization
            const existing = await db().posthog_integrations.findFirst({
                where: { organization_id: organizationId }
            })

            if (existing) {
                // Update existing integration
                await db().posthog_integrations.update({
                    where: { id: existing.id },
                    data: {
                        api_key: apiKey,
                        user_email: userEmail,
                        org_name: orgName,
                        organization_id: organizationId
                    }
                })
                logger.info("✅ Updated Posthog integration", {
                    integrationId: existing.id,
                    userId,
                    email: userEmail
                })
            } else {
                // Create new integration
                const integration = await db().posthog_integrations.create({
                    data: {
                        user_id: userId,
                        organization_id: organizationId,
                        api_key: apiKey,
                        user_email: userEmail,
                        org_name: orgName
                    }
                })
                logger.info("✅ Created Posthog integration", {
                    integrationId: integration.id,
                    userId,
                    email: userEmail
                })
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    email: userEmail,
                    orgName: orgName
                }
            }
        } catch (error) {
            logger.error("Error processing Posthog form submission", { error })
            return {
                success: false,
                error: "Failed to process integration",
                statusCode: 500
            }
        }
    }
}

/**
 * Verifies that the given PostHog project exists and is accessible with the integration's API key.
 */
export async function validatePosthogProjectExists(integrationId: string, projectId: string): Promise<void> {
    const integration = await db().posthog_integrations.findUnique({
        where: { id: integrationId },
        select: { api_key: true }
    })
    if (!integration?.api_key) {
        throw new Error(`Posthog integration ${integrationId} not found or missing API key`)
    }
    const response = await fetch(`https://us.posthog.com/api/projects/${projectId}/`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${integration.api_key}`,
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`Posthog project ${projectId} not accessible`, { status: response.status, errorText })
        throw new Error(`Posthog project ${projectId} not found or not accessible`)
    }
}
