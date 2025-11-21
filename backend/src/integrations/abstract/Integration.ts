import { OAuthInstallationDetails } from "../../shared/types";
import { IntegrationInstance, IntegrationDetails, IntegrationType } from "../../shared/Integrations";
import { ChannelInputWithConfigs } from "../../types/prisma";

// This ensures T is a valid Prisma model type
export interface Integration<T extends IntegrationInstance, W, M extends IntegrationDetails>  {
    integrationType: IntegrationType;
    getInstancesForUser(userId: string): Promise<T[]>;
    /**
     * Get all active integration instances (not filtered by user).
     * Used for periodic maintenance tasks like token refresh.
     * @returns Array of integration instances
     */
    getAllActiveInstances(): Promise<T[]>;
    processWebhookEvent(event: W): Promise<void>;
    deleteInstallation(integrationId: string): Promise<void>;
    setupChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void>;
    teardownChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void>;
}

export interface OAuthIntegrationInstallation {
    getInstallationUrl(userId: string): Promise<OAuthInstallationDetails>;
    processInstallationCallback(req: any, res: any): Promise<void>;
    /**
     * Refresh the access token for a specific integration instance.
     * Returns true if the token was refreshed, false if it didn't need refreshing or if refresh failed.
     * @param integrationId - The ID of the integration instance to refresh
     */
    refreshToken(integrationId: string): Promise<boolean>;
    /**
     * Get a valid access token for an integration instance.
     * This method handles token refresh automatically if the token is expired or expiring soon.
     * This is the standardized way to access tokens - always use this instead of directly accessing tokens.
     * @param integrationId - The ID of the integration instance
     * @returns The access token string, or null if the token cannot be obtained
     */
    getAccessToken(integrationId: string): Promise<string | null>;
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