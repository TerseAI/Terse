import { ApolloIntegration, ApolloIntegrationMetadata, FormFieldDefinition, FormIntegrationSetup, IntegrationType } from "terse-types"
import { z } from "zod"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

import { validateApolloApiKey } from "./apiClient"

export class ApolloIntegrationManager extends Integration<ApolloIntegration, never, typeof ApolloIntegrationMetadata, never> implements FormIntegrationInstallation<IntegrationType.APOLLO> {
    readonly integrationType = IntegrationType.APOLLO
    readonly secretSchema = z.object({ apiKey: z.string() })

    async getInstancesForOrganization(organizationId: string): Promise<ApolloIntegration[]> {
        return db().apollo_integrations.findMany({ where: { organization_id: organizationId }, select: { id: true } })
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [integration] = await this.getInstancesForOrganization(organizationId)
        return integration ? createConnectedCliDisplayState("Apollo", "API key connected", integration.id) : createNotConnectedCliDisplayState()
    }

    formatIntegrationInstanceForAgent(instance: ApolloIntegration): string {
        return `Apollo [id: ${instance.id}]`
    }

    getConnectionName(instance: ApolloIntegration): string {
        return instance.id
    }

    async getAllActiveInstances(): Promise<ApolloIntegration[]> {
        return db().apollo_integrations.findMany({ select: { id: true } })
    }

    async processWebhookEvent(_event: never): Promise<void> {}
    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}
    async teardownAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

    async deleteInstallation(integrationId: string): Promise<void> {
        await db().apollo_integrations.delete({ where: { id: integrationId } })
        await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.APOLLO, recordId: integrationId } })
    }

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "apiKey",
                type: "password",
                label: "API Key",
                placeholder: "Enter your Apollo.io API key",
                required: true,
                hint: "Create an API key in Apollo under Settings > Integrations > API Keys. People search requires a master API key; enrichment works with a scoped key."
            }
        ]
    }

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Connect Apollo",
            url: "https://developer.apollo.io/keys/",
            instructions: [
                "Create an API key in Apollo under Settings > Integrations > API Keys.",
                "Enable it as a master key if you want people search; enrichment works with a key scoped to the enrichment endpoints.",
                "Enrichment calls consume Apollo export credits from your plan."
            ]
        }
    }

    async processFormSubmission({ organizationId, formValues }: FormSubmissionInput): Promise<FormSubmissionResult> {
        const apiKey = formValues.apiKey?.trim()
        if (!apiKey) return { success: false, error: "API key is required", statusCode: 400 }

        try {
            await validateApolloApiKey(apiKey)
            const existing = await db().apollo_integrations.findFirst({ where: { organization_id: organizationId } })
            const integration = existing ?? (await db().apollo_integrations.create({ data: { organization_id: organizationId } }))
            await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.APOLLO, recordId: integration.id, value: { apiKey } } })
            return { success: true, statusCode: 200, data: { integrationId: integration.id } }
        } catch (error) {
            logger.warn("Apollo API key validation failed", { error })
            return { success: false, error: error instanceof Error ? error.message : "Invalid Apollo API key", statusCode: 400 }
        }
    }
}
