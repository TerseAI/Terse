import { FormFieldDefinition, FormIntegrationSetup } from "terse-types"
import { IntegrationType, LaunchDarklyIntegration, LaunchDarklyIntegrationMetadata } from "terse-types/Integrations"
import { LaunchDarklyProject } from "terse-types/types"
import { z } from "zod"

import logger from "../logger"
import { db } from "../prismaClient"
import { fetchLaunchDarklyEnvironments, fetchLaunchDarklyProjects } from "../routes/launchdarkly"
import { SecretService } from "../services/SecretService"
import { AgentTriggerWithConfigs } from "../types/prisma"

import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import {
    FormIntegrationInstallation,
    FormSubmissionInput,
    FormSubmissionResult,
    Integration,
    IntegrationWithResources,
    createConnectedCliDisplayState,
    createNotConnectedCliDisplayState
} from "./abstract/Integration"

export class LaunchDarklyIntegrationManager
    extends Integration<LaunchDarklyIntegration, never, typeof LaunchDarklyIntegrationMetadata, LaunchDarklyProject>
    implements FormIntegrationInstallation<IntegrationType.LAUNCHDARKLY>
{
    readonly integrationType = IntegrationType.LAUNCHDARKLY
    readonly secretSchema = z.object({
        apiKey: z.string()
    })

    async getInstancesForOrganization(organizationId: string): Promise<LaunchDarklyIntegration[]> {
        const launchdarklyIntegrations = await db().launchdarkly_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                user_email: true,
                token_name: true
            }
        })
        return launchdarklyIntegrations.map(li => ({
            id: li.id,
            email: li.user_email || undefined,
            tokenName: li.token_name || undefined
        }))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integration = await db().launchdarkly_integrations.findFirst({
            where: { organization_id: organizationId },
            orderBy: { created_at: "asc" }
        })

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Account", integration.token_name || integration.user_email || "LaunchDarkly", integration.id)
    }

    async fetchResourcesForOrganization(
        organizationId: string,
        query?: string,
        _options?: FetchResourcesOptions
    ): Promise<
        IntegrationWithResources<
            LaunchDarklyIntegration,
            LaunchDarklyProject & {
                environments: Array<{ key: string; name: string }>
            }
        >[]
    > {
        const integrations = await this.getInstancesForOrganization(organizationId)
        return await Promise.all(
            integrations.map(async integration => {
                try {
                    const projectsResponse = await fetchLaunchDarklyProjects(organizationId, integration.id, query ?? "")
                    const projectsWithEnvironments = await Promise.all(
                        projectsResponse.projects.map(async project => {
                            const envsResponse = await fetchLaunchDarklyEnvironments(organizationId, integration.id, project.key)
                            return {
                                ...project,
                                environments: envsResponse.environments
                            }
                        })
                    )
                    return { integration, resources: projectsWithEnvironments }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for LaunchDarkly integration ${integration.id}`, { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: LaunchDarklyIntegration): string {
        const details: string[] = []
        if (instance.tokenName) {
            details.push(`token "${instance.tokenName}"`)
        }
        if (instance.email) {
            details.push(`email ${instance.email}`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `LaunchDarkly${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<LaunchDarklyIntegration[]> {
        const launchdarklyIntegrations = await db().launchdarkly_integrations.findMany({
            select: {
                id: true,
                user_email: true,
                token_name: true
            }
        })
        return launchdarklyIntegrations.map(li => ({
            id: li.id,
            email: li.user_email || undefined,
            tokenName: li.token_name || undefined
        }))
    }

    // Mark: Webhook processing support, stubbed out for now.
    async processWebhookEvent(event: never): Promise<void> {
        // LaunchDarkly webhooks are handled elsewhere
        throw new Error("LaunchDarkly webhooks are not processed through this integration manager")
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return db()
            .$transaction(async tx => {
                await tx.launchdarkly_integrations.delete({ where: { id: integrationId } })
            })
            .then(async () => {
                await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.LAUNCHDARKLY, recordId: integrationId } })
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
                placeholder: "Enter your LaunchDarkly API key",
                required: true,
                hint: "Your LaunchDarkly API key (service token or access token). Find this in LaunchDarkly under Account Settings → Authorization → Tokens."
            }
        ]
    }

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Create a LaunchDarkly Token",
            url: "https://launchdarkly.com/docs/home/account/api-create",
            instructions: [
                "Prefer a service token for long-lived automation.",
                "Grant read access to projects, environments, and feature flags.",
                "Include audit log read access if you want change history."
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
            // Validate API key by calling LaunchDarkly API
            // Use /api/v2/projects endpoint which works for both service tokens and access tokens
            const validationResponse = await fetch("https://app.launchdarkly.com/api/v2/projects", {
                method: "GET",
                headers: {
                    Authorization: apiKey,
                    "Content-Type": "application/json"
                }
            })

            // Reject all non-2xx responses
            if (!validationResponse.ok) {
                const errorText = await validationResponse.text()
                logger.error("LaunchDarkly API key validation failed", {
                    userId,
                    status: validationResponse.status,
                    error: errorText
                })
                return {
                    success: false,
                    error: validationResponse.status === 401 ? "Invalid API key" : "API key validation failed",
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 401 ? "Authentication failed" : `API returned status ${validationResponse.status}`
                    }
                }
            }

            // Token is valid (200)
            // Try to get token name from /api/v2/tokens endpoint
            let tokenName: string | null = null
            try {
                const tokensResponse = await fetch("https://app.launchdarkly.com/api/v2/tokens", {
                    method: "GET",
                    headers: {
                        Authorization: apiKey,
                        "Content-Type": "application/json"
                    }
                })

                if (tokensResponse.ok) {
                    const tokensData = await tokensResponse.json()
                    // Tokens response is typically an object with items array
                    const tokens = Array.isArray(tokensData) ? tokensData : tokensData.items || tokensData.tokens || []

                    // Try to find the token by matching last 4 chars (only info we can get)
                    // Since we can't match by full value, we'll use the first token as a best guess
                    // or try to match by most recently used/created
                    if (tokens.length > 0) {
                        // Sort by lastUsed or creationDate descending to get most recent first
                        const sortedTokens = [...tokens].sort((a: any, b: any) => {
                            const aTime = a.lastUsed || a.creationDate || 0
                            const bTime = b.lastUsed || b.creationDate || 0
                            return bTime - aTime
                        })
                        tokenName = sortedTokens[0]?.name || null
                    }
                }
            } catch (tokenError) {
                logger.warn("Failed to fetch LaunchDarkly token info", {
                    error: tokenError
                })
            }

            const userEmail: string | null = null

            const integration = await db().launchdarkly_integrations.upsert({
                where: { organization_id: organizationId },
                update: {
                    user_email: userEmail,
                    token_name: tokenName
                },
                create: {
                    user_id: userId,
                    organization_id: organizationId,
                    user_email: userEmail,
                    token_name: tokenName
                }
            })

            await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.LAUNCHDARKLY, recordId: integration.id, value: { apiKey: apiKey } } })

            logger.info("✅ Upserted LaunchDarkly integration", {
                integrationId: integration.id,
                userId,
                email: userEmail,
                tokenName
            })

            return {
                success: true,
                statusCode: 200,
                data: {
                    email: userEmail,
                    tokenName: tokenName
                }
            }
        } catch (error) {
            logger.error("Error processing LaunchDarkly form submission", { error })
            return {
                success: false,
                error: "Failed to process integration",
                statusCode: 500
            }
        }
    }
}

/**
 * Returns the LaunchDarkly API key for the given integration. Use once then pass to validateLaunchDarklyProjectExists / validateLaunchDarklyEnvironmentsExist.
 */
export async function getLaunchDarklyAccessTokenOrThrow(integrationId: string): Promise<string> {
    const integration = await db().launchdarkly_integrations.findUnique({
        where: { id: integrationId },
        select: { id: true }
    })
    if (!integration) {
        throw new Error(`LaunchDarkly integration ${integrationId} not found or missing API key`)
    }
    const secretService = SecretService.getInstance()
    const secret = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.LAUNCHDARKLY, recordId: integrationId } })
    return secret.apiKey
}

/**
 * Verifies that the given LaunchDarkly project exists and is accessible with the provided API key.
 */
export async function validateLaunchDarklyProjectExists(apiKey: string, projectKey: string): Promise<void> {
    const response = await fetch(`https://app.launchdarkly.com/api/v2/projects/${projectKey}`, {
        method: "GET",
        headers: {
            Authorization: apiKey,
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`LaunchDarkly project ${projectKey} not accessible`, { status: response.status, errorText })
        throw new Error(`LaunchDarkly project ${projectKey} not found or not accessible`)
    }
}

/**
 * Verifies that the given LaunchDarkly environments exist for the project.
 */
export async function validateLaunchDarklyEnvironmentsExist(apiKey: string, projectKey: string, environmentKeys: string[]): Promise<void> {
    if (!environmentKeys.length) return
    const response = await fetch(`https://app.launchdarkly.com/api/v2/projects/${projectKey}/environments`, {
        method: "GET",
        headers: {
            Authorization: apiKey,
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) {
        const errorText = await response.text()
        logger.error(`LaunchDarkly environments for project ${projectKey} not accessible`, {
            status: response.status,
            errorText
        })
        throw new Error(`LaunchDarkly project ${projectKey} or environments not accessible`)
    }
    const data = await response.json()
    const environments = Array.isArray(data) ? data : data.items || data.environments || []
    const validKeys = new Set(environments.map((e: { key?: string; _id?: string }) => e.key || e._id))
    const missing = environmentKeys.filter(k => !validKeys.has(k))
    if (missing.length > 0) {
        throw new Error(`LaunchDarkly environment(s) not found: ${missing.join(", ")}`)
    }
}
