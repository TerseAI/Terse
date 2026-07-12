import { FormFieldDefinition, FormIntegrationSetup } from "terse-types"
import { IntegrationType, PosthogIntegration, PosthogIntegrationMetadata } from "terse-types/Integrations"
import { PosthogProject } from "terse-types/types"
import { z } from "zod"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { fetchPosthogProjects } from "../../modules/integrations/posthog/controller"
import { SecretService } from "../../services/SecretService"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { FetchResourcesOptions } from "../abstract/FetchResourcesOptions"
import {
    FormIntegrationInstallation,
    FormSubmissionInput,
    FormSubmissionResult,
    Integration,
    IntegrationWithResources,
    createConnectedCliDisplayState,
    createNotConnectedCliDisplayState
} from "../abstract/Integration"

export class PosthogIntegrationManager
    extends Integration<PosthogIntegration, never, typeof PosthogIntegrationMetadata, PosthogProject>
    implements FormIntegrationInstallation<IntegrationType.POSTHOG>
{
    readonly integrationType = IntegrationType.POSTHOG
    readonly secretSchema = z.object({
        apiKey: z.string()
    })

    async getInstancesForOrganization(organizationId: string): Promise<PosthogIntegration[]> {
        const posthogIntegrations = await db().posthog_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                user_email: true,
                org_name: true
            },
            orderBy: { created_at: "asc" }
        })
        return posthogIntegrations.map(pi => ({
            id: pi.id,
            email: pi.user_email || undefined,
            orgName: pi.org_name || undefined
        }))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [instance] = await this.getInstancesForOrganization(organizationId)

        if (!instance) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Account", this.getConnectionName(instance), instance.id)
    }

    getConnectionName(instance: PosthogIntegration): string {
        return instance.orgName || instance.email || instance.id
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
            email: pi.user_email || undefined,
            orgName: pi.org_name || undefined
        }))
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // Posthog webhooks are handled elsewhere
        throw new Error("Posthog webhooks are not processed through this integration manager")
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return db()
            .$transaction(async tx => {
                await tx.posthog_integrations.delete({ where: { id: integrationId } })
            })
            .then(async () => {
                await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.POSTHOG, recordId: integrationId } })
            })
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

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Get a PostHog Personal API Key",
            url: "https://us.posthog.com/settings/user-api-keys",
            instructions: [
                "Use a Personal API Key, not a Project API Key.",
                "Grant these read-only scopes: query:read, logs:read, person:read, session_recording:read, user:read, project:read.",
                "Use a key from an account with access to the target PostHog project.",
                "This integration currently supports US PostHog Cloud only."
            ]
        }
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
                const error = describeKeyValidationFailure(validationResponse.status, errorText)
                logger.error("Posthog API key validation failed", {
                    status: validationResponse.status,
                    error: errorText,
                    userMessage: error
                })
                return {
                    success: false,
                    error,
                    statusCode: 400
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
                await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.POSTHOG, recordId: existing.id, value: { apiKey: apiKey } } })

                // Update existing integration
                await db().posthog_integrations.update({
                    where: { id: existing.id },
                    data: {
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
                        user_email: userEmail,
                        org_name: orgName
                    }
                })

                await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.POSTHOG, recordId: integration.id, value: { apiKey: apiKey } } })

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
 * Turns a PostHog auth failure into a message the user can act on. PostHog returns a
 * JSON body whose `detail` names the problem — for scoped keys that's the exact missing
 * scope (e.g. "API key missing required scope 'user:read'").
 */
function describeKeyValidationFailure(status: number, errorBody: string): string {
    let detail: string | undefined
    try {
        const parsed = z.object({ detail: z.string() }).safeParse(JSON.parse(errorBody))
        if (parsed.success) {
            detail = parsed.data.detail
        }
    } catch {
        // Non-JSON body — fall through to the generic messages below.
    }
    if (detail) {
        return `PostHog rejected the API key: ${detail}`
    }
    if (status === 401) {
        return "PostHog rejected the API key. Make sure it is a Personal API Key for US PostHog Cloud."
    }
    return `PostHog API key validation failed (HTTP ${status})`
}

/**
 * Verifies that the given PostHog project exists and is accessible with the integration's API key.
 */
export async function validatePosthogProjectExists(integrationId: string, projectId: string): Promise<void> {
    const integration = await db().posthog_integrations.findUnique({
        where: { id: integrationId },
        select: { id: true }
    })
    if (!integration) {
        throw new Error(`Posthog integration ${integrationId} not found or missing API key`)
    }
    const secretService = SecretService.getInstance()
    const secret = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.POSTHOG, recordId: integrationId } })
    const apiKey = secret.apiKey
    const response = await fetch(`https://us.posthog.com/api/projects/${projectId}/`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`Posthog project ${projectId} not accessible`, { status: response.status, errorText })
        throw new Error(`Posthog project ${projectId} not found or not accessible`)
    }
}
