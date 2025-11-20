import { OAuthInstallationDetails } from "../../shared/types";
import { IntegrationInstance, IntegrationDetails, IntegrationType } from "../../shared/Integrations";
import { ChannelInputWithConfigs } from "../../types/prisma";

// This ensures T is a valid Prisma model type
export interface Integration<T extends IntegrationInstance, W, M extends IntegrationDetails>  {
    integrationType: IntegrationType;
    getInstancesForUser(userId: string): Promise<T[]>;
    processWebhookEvent(event: W): Promise<void>;
    deleteInstallation(integrationId: string): Promise<void>;
    setupChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void>;
    teardownChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void>;
}

export interface OAuthIntegrationInstallation {
    getInstallationUrl(userId: string): Promise<OAuthInstallationDetails>;
    processInstallationCallback(req: any, res: any): Promise<void>;
}

// Type guards
export function isOAuthIntegrationInstallation(
    obj: any
): obj is OAuthIntegrationInstallation {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        'getInstallationUrl' in obj &&
        typeof obj.getInstallationUrl === 'function'
    );
}