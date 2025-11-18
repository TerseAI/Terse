import { IntegrationType } from "@prisma/client";
import { IntegrationMetadata, OAuthInstallationDetails } from "../../shared/types";

// This ensures T is a valid Prisma model type
export interface Integration<T, WebhookEvent, M extends IntegrationMetadata>  {
    integrationType: IntegrationType;
    getInstancesForUser(userId: string): Promise<T[]>;
    processWebhookEvent(event: WebhookEvent): Promise<void>;
    getIntegrationMetadata(): Promise<M>;
}

export interface OAuthIntegrationInstallation {
    getInstallationUrl(userId: string): OAuthInstallationDetails;
    processInstallationCallback(req: Request, res: Response): Promise<void>;
    deleteInstallation(integrationId: string): Promise<void>;
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