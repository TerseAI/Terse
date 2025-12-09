import { OAuthInstallationDetails } from "../../shared/types";
import { IntegrationInstance, IntegrationDetails, IntegrationType, InstallationOptionsFor } from "../../shared/Integrations";
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

export interface OAuthIntegrationInstallation<T extends IntegrationType> {
    getInstallationUrl(userId: string, options: InstallationOptionsFor<T>): Promise<OAuthInstallationDetails>;
    processInstallationCallback(req: Request, res: Response): Promise<void>;
    refreshToken(integrationId: string): Promise<boolean>;
    getAccessToken(integrationId: string): Promise<string | null>;
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