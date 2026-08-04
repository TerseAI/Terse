import { FormFieldDefinition, FormIntegrationSetup, HiggsfieldIntegration, HiggsfieldIntegrationMetadata, IntegrationType } from "terse-types"
import { z } from "zod"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

import { verifyHiggsfieldCredentials } from "./apiClient"

export class HiggsfieldIntegrationManager
    extends Integration<HiggsfieldIntegration, never, typeof HiggsfieldIntegrationMetadata, never>
    implements FormIntegrationInstallation<IntegrationType.HIGGSFIELD>
{
    readonly integrationType = IntegrationType.HIGGSFIELD
    readonly secretSchema = z.object({ credentials: z.string() })

    async getInstancesForOrganization(organizationId: string): Promise<HiggsfieldIntegration[]> {
        return db().higgsfield_integrations.findMany({ where: { organization_id: organizationId }, select: { id: true } })
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [integration] = await this.getInstancesForOrganization(organizationId)
        return integration ? createConnectedCliDisplayState("Higgsfield", "API key connected", integration.id) : createNotConnectedCliDisplayState()
    }

    formatIntegrationInstanceForAgent(instance: HiggsfieldIntegration): string {
        return `Higgsfield [id: ${instance.id}]`
    }

    getConnectionName(instance: HiggsfieldIntegration): string {
        return instance.id
    }

    async getAllActiveInstances(): Promise<HiggsfieldIntegration[]> {
        return db().higgsfield_integrations.findMany({ select: { id: true } })
    }

    async processWebhookEvent(_event: never): Promise<void> {}
    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}
    async teardownAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

    async deleteInstallation(integrationId: string): Promise<void> {
        await db().higgsfield_integrations.delete({ where: { id: integrationId } })
        await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.HIGGSFIELD, recordId: integrationId } })
    }

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "credentials",
                type: "password",
                label: "API Credentials",
                placeholder: "KEY_ID:KEY_SECRET",
                required: true,
                hint: "Paste your Higgsfield key id and secret joined by a colon."
            }
        ]
    }

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Connect Higgsfield",
            url: "https://platform.higgsfield.ai",
            instructions: ["Create an API key on the Higgsfield platform.", 'Paste it as "KEY_ID:KEY_SECRET".']
        }
    }

    async processFormSubmission({ organizationId, formValues }: FormSubmissionInput): Promise<FormSubmissionResult> {
        const credentials = formValues.credentials?.trim()
        if (!credentials) return { success: false, error: "API credentials are required", statusCode: 400 }

        try {
            await verifyHiggsfieldCredentials(credentials)
            const existing = await db().higgsfield_integrations.findFirst({ where: { organization_id: organizationId } })
            const integration = existing ?? (await db().higgsfield_integrations.create({ data: { organization_id: organizationId } }))
            await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.HIGGSFIELD, recordId: integration.id, value: { credentials } } })
            return { success: true, statusCode: 200, data: { integrationId: integration.id } }
        } catch (error) {
            logger.warn("Higgsfield credential validation failed", { error })
            return { success: false, error: error instanceof Error ? error.message : "Invalid Higgsfield credentials", statusCode: 400 }
        }
    }

    async getCredentials(integrationId: string): Promise<string> {
        const secrets = await this.secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.HIGGSFIELD, recordId: integrationId } })
        return secrets.credentials
    }
}
