import { Request, Response } from "express"
import { AdditionalStateParams, CliIntegrationDisplayState, InstallationOptionsFor, IntegrationDetails, IntegrationInstance, IntegrationType } from "terse-types"
import type { ConfigData, ConfigurationFieldDefinition, FormFieldDefinition, FormIntegrationSetup } from "terse-types"
import { OAuthInstallationDetails } from "terse-types"
import { z } from "zod"

import logger from "../../common/logger"
import { SecretService } from "../../services/SecretService"
import { settings } from "../../settings"
import { AgentTriggerWithConfigs } from "../../types/prisma"

import { FetchResourcesOptions } from "./FetchResourcesOptions"
import type { TriggerRuntime } from "./TriggerRuntime"

export interface IntegrationWithResources<T extends IntegrationInstance, R> {
    integration: T
    resources: R[]
}

// This ensures T is a valid Prisma model type
export abstract class Integration<T extends IntegrationInstance, W, M extends IntegrationDetails, R> {
    protected get secretService(): SecretService {
        return SecretService.getInstance()
    }
    abstract integrationType: IntegrationType
    secretSchema?: z.ZodObject<z.ZodRawShape>
    abstract getInstancesForOrganization(organizationId: string): Promise<T[]>
    abstract getCliDisplayStateForOrganization(organizationId: string): Promise<CliIntegrationDisplayState>
    abstract formatIntegrationInstanceForAgent(instance: T): string
    abstract getAllActiveInstances(): Promise<T[]>
    abstract processWebhookEvent(event: W): Promise<void>
    abstract deleteInstallation(integrationId: string): Promise<void>
    abstract setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void>
    abstract teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void>
    fetchResourcesForOrganization?(organizationId: string, query?: string, options?: FetchResourcesOptions): Promise<IntegrationWithResources<T, R>[]> {
        logger.warn("fetchResourcesForOrganization is not implemented for integration type", { integrationType: this.integrationType })
        return Promise.resolve([])
    }

    readonly settingsKey: keyof typeof settings | null = null

    get isAvailable(): boolean {
        return this.settingsKey === null || settings[this.settingsKey] !== undefined
    }

    get config(): NonNullable<(typeof settings)[Exclude<this["settingsKey"], null>]> {
        if (this.settingsKey === null) {
            throw new Error(`Integration ${this.integrationType} has no settings key`)
        }
        const value = settings[this.settingsKey]
        if (value === undefined) {
            throw new Error(`Integration ${this.integrationType} is not configured`)
        }
        return value as NonNullable<(typeof settings)[Exclude<this["settingsKey"], null>]>
    }

    getSampleEvents?(
        integrationId: string,
        organizationId: string,
        userId: string,
        triggerConfig: ConfigData,
        options?: {
            limit?: number
            triggerId?: string
        }
    ): Promise<TriggerRuntime[]> {
        logger.warn("getSampleEvents is not implemented for integration type", { integrationType: this.integrationType })
        return Promise.resolve([])
    }
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
    getFormSetup?(): FormIntegrationSetup | undefined
    processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult>
}

export interface OAuthIntegrationInstallation<T extends IntegrationType> {
    getInstallationUrl(
        userId: string,
        organizationId: string,
        options: InstallationOptionsFor<T>,
        additionalStatePayload: AdditionalStateParams | undefined,
        req: Request,
        res: Response
    ): Promise<OAuthInstallationDetails>
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

export function createNotConnectedCliDisplayState(): CliIntegrationDisplayState {
    return { status: "not_connected" }
}

export function createConnectedCliDisplayState(summaryLabel: string, summaryValue: string, integrationId: string): CliIntegrationDisplayState {
    return {
        status: "connected",
        summaryLabel,
        summaryValue,
        integrationId
    }
}
