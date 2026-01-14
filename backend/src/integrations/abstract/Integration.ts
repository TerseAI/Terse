import { OAuthInstallationDetails } from "../../shared/types";
import { IntegrationInstance, IntegrationDetails, IntegrationType, InstallationOptionsFor, AdditionalStateParams } from "../../shared/Integrations";
import { ChannelInputWithConfigs } from "../../types/prisma";
import { Request, Response } from "express";

// This ensures T is a valid Prisma model type
export interface Integration<T extends IntegrationInstance, W, M extends IntegrationDetails>  {
    integrationType: IntegrationType;
    getInstancesForUser(userId: string): Promise<T[]>;
    getAllActiveInstances(): Promise<T[]>;
    processWebhookEvent(event: W): Promise<void>;
    deleteInstallation(integrationId: string): Promise<void>;
    setupChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void>;
    teardownChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void>;
}

export type FormFieldType = 'text' | 'password' | 'textarea';

export interface FormFieldDefinition {
    name: string;
    type: FormFieldType;
    label: string;
    placeholder?: string;
    required?: boolean;
    hint?: string;
}

export interface FormIntegrationInstallation<T extends IntegrationType> {
    getFormFields(): FormFieldDefinition[];
    processFormSubmission(req: Request, res: Response): Promise<void>;
}

export type ConfigurationFieldType = 'radio' | 'select';

export interface ConfigurationOption {
    label: string;
    value: string;
}

export interface ConfigurationFieldDefinition {
    name: string;
    type: ConfigurationFieldType;
    label: string;
    options: ConfigurationOption[]; // Required for radio and select fields
    required?: boolean;
    hint?: string;
}

export interface OAuthIntegrationInstallation<T extends IntegrationType> {
    getInstallationUrl(userId: string, options?: InstallationOptionsFor<T>, additionalStatePayload?: AdditionalStateParams): Promise<OAuthInstallationDetails>;
    processInstallationCallback(req: Request, res: Response): Promise<void>;
    refreshToken(integrationId: string): Promise<boolean>;
    getAccessToken(integrationId: string): Promise<string | null>;
    getConfigurationFields(): ConfigurationFieldDefinition[];
}

// Type guards
export function isOAuthIntegrationInstallation<T extends IntegrationType>(
    obj: any
): obj is OAuthIntegrationInstallation<T> {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        'getInstallationUrl' in obj &&
        typeof obj.getInstallationUrl === 'function'
    );
}

export function isFormIntegrationInstallation<T extends IntegrationType>(
    obj: any
): obj is FormIntegrationInstallation<T> {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        'getFormFields' in obj &&
        typeof obj.getFormFields === 'function' &&
        'processFormSubmission' in obj &&
        typeof obj.processFormSubmission === 'function'
    );
}