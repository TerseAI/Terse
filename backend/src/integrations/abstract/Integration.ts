import { Request, Response } from "express"
import { ConfigInstance } from "terse-types"
import { AdditionalStateParams, InstallationOptionsFor, IntegrationDetails, IntegrationInstance, IntegrationType } from "terse-types"
import type { ConfigurationFieldDefinition, ConfigurationFieldType, ConfigurationOption, FormFieldDefinition, FormFieldType } from "terse-types"
import { OAuthInstallationDetails } from "terse-types"

import { AgentTriggerWithConfigs } from "../../types/prisma"

import type { FetchResourcesOptions } from "./FetchResourcesOptions"
import type { InputEvent } from "./InputEvent"

export type { FormFieldDefinition, ConfigurationFieldDefinition, ConfigurationOption, ConfigurationFieldType, FormFieldType } from "terse-types"

export interface IntegrationWithResources<T extends IntegrationInstance, R> {
    integration: T
    resources: R[]
}

// This ensures T is a valid Prisma model type
export interface Integration<T extends IntegrationInstance, W, M extends IntegrationDetails, R> {
    integrationType: IntegrationType
    getInstancesForOrganization(organizationId: string): Promise<T[]>
    formatIntegrationInstanceForAgent(instance: T): string
    getAllActiveInstances(): Promise<T[]>
    processWebhookEvent(event: W): Promise<void>
    deleteInstallation(integrationId: string): Promise<void>
    setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void>
    teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void>

    fetchResourcesForOrganization?(organizationId: string, query?: string, options?: FetchResourcesOptions): Promise<IntegrationWithResources<T, R>[]>

    getSampleEvents?(
        integrationId: string,
        organizationId: string,
        userId: string,
        triggerConfig: ConfigInstance,
        options?: {
            limit?: number
        }
    ): Promise<InputEvent[]>
}

export interface FormSubmissionInput {
    userId: string
    organizationId: string
    formValues: Record<string, string>
}

export interface FormSubmissionResult {
    success: boolean
    data?: any
    error?: string
    statusCode?: number
}

export interface FormIntegrationInstallation<T extends IntegrationType> {
    getFormFields(): FormFieldDefinition[]
    processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult>
}

export interface OAuthIntegrationInstallation<T extends IntegrationType> {
    getInstallationUrl(userId: string, organizationId: string, options?: InstallationOptionsFor<T>, additionalStatePayload?: AdditionalStateParams): Promise<OAuthInstallationDetails>
    processInstallationCallback(req: Request, res: Response): Promise<void>
    refreshToken(integrationId: string): Promise<boolean>
    getAccessToken(integrationId: string): Promise<string | null>
    getConfigurationFields(): ConfigurationFieldDefinition[]
}

// Type guards
export function isOAuthIntegrationInstallation<T extends IntegrationType>(obj: any): obj is OAuthIntegrationInstallation<T> {
    return obj !== null && typeof obj === "object" && "getInstallationUrl" in obj && typeof obj.getInstallationUrl === "function"
}

export function isFormIntegrationInstallation<T extends IntegrationType>(obj: any): obj is FormIntegrationInstallation<T> {
    return (
        obj !== null &&
        typeof obj === "object" &&
        "getFormFields" in obj &&
        typeof obj.getFormFields === "function" &&
        "processFormSubmission" in obj &&
        typeof obj.processFormSubmission === "function"
    )
}

/**
 * Parse form submission input from an Express Request object.
 * Extracts userId and organizationId from session and formValues from body.
 * Returns null if user is not authenticated.
 */
export function parseFormSubmissionFromRequest(req: Request): FormSubmissionInput | null {
    if (!req.session?.user) {
        return null
    }

    return {
        userId: req.session.user.id,
        organizationId: req.session.user.organizationId,
        formValues: req.body || {}
    }
}
