import { FormFieldDefinition, FormIntegrationSetup, IntegrationType, ResendIntegration, ResendIntegrationMetadata, ResendTemplate } from "terse-types"
import { z } from "zod"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { SecretService } from "../../services/SecretService"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

import { listResendTemplates } from "./apiClient"

export class ResendIntegrationManager extends Integration<ResendIntegration, never, typeof ResendIntegrationMetadata, ResendTemplate> implements FormIntegrationInstallation<IntegrationType.RESEND> {
    readonly integrationType = IntegrationType.RESEND
    readonly secretSchema = z.object({ apiKey: z.string() })

    async getInstancesForOrganization(organizationId: string): Promise<ResendIntegration[]> {
        return db().resend_integrations.findMany({ where: { organization_id: organizationId }, select: { id: true } })
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [integration] = await this.getInstancesForOrganization(organizationId)
        return integration ? createConnectedCliDisplayState("Resend", "API key connected", integration.id) : createNotConnectedCliDisplayState()
    }

    formatIntegrationInstanceForAgent(instance: ResendIntegration): string {
        return `Resend [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<ResendIntegration[]> {
        return db().resend_integrations.findMany({ select: { id: true } })
    }

    async processWebhookEvent(_event: never): Promise<void> {}
    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}
    async teardownAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

    async deleteInstallation(integrationId: string): Promise<void> {
        await db().resend_integrations.delete({ where: { id: integrationId } })
        await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.RESEND, recordId: integrationId } })
    }

    getFormFields(): FormFieldDefinition[] {
        return [{ name: "apiKey", type: "password", label: "API Key", placeholder: "re_...", required: true, hint: "Use a Resend API key with template read and email send access." }]
    }

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Connect Resend",
            url: "https://resend.com/api-keys",
            instructions: ["Create an API key that can list templates and send email."]
        }
    }

    async processFormSubmission({ organizationId, formValues }: FormSubmissionInput): Promise<FormSubmissionResult> {
        const apiKey = formValues.apiKey?.trim()
        if (!apiKey) return { success: false, error: "API key is required", statusCode: 400 }

        try {
            await listResendTemplates(apiKey)
            const existing = await db().resend_integrations.findFirst({ where: { organization_id: organizationId } })
            const integration = existing ?? (await db().resend_integrations.create({ data: { organization_id: organizationId } }))
            await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.RESEND, recordId: integration.id, value: { apiKey } } })
            return { success: true, statusCode: 200, data: { integrationId: integration.id } }
        } catch (error) {
            logger.warn("Resend API key validation failed", { error })
            return { success: false, error: error instanceof Error ? error.message : "Invalid Resend API key", statusCode: 400 }
        }
    }
}

export async function fetchResendTemplates(organizationId: string, integrationId: string): Promise<ResendTemplate[]> {
    const integration = await db().resend_integrations.findFirst({ where: { id: integrationId, organization_id: organizationId } })
    if (!integration) throw new Error("Resend integration not found")
    const secrets = await SecretService.getInstance().getSecrets({ type: "integration", secret: { integrationType: IntegrationType.RESEND, recordId: integrationId } })
    return listResendTemplates(secrets.apiKey)
}
