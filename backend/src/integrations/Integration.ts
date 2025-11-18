import { GmailIntegrationManager } from "./GmailIntegration";

// This ensures T is a valid Prisma model type
export interface Integration<T, WebhookEvent> {
    getInstancesForUser(userId: string): Promise<T[]>;
    processWebhookEvent(event: WebhookEvent): Promise<void>;

    // deleteIntegration
    // supportedConfigs
    // refreshResources
    // refreshTokens
}


export const IntegrationRegistry: Integration<any, any>[] = [
    new GmailIntegrationManager(),
]


