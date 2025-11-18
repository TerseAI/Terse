import { FigmaIntegrationManager } from "../FigmaIntegration";
import { GithubIntegrationManager } from "../GithubIntegration";
import { GmailIntegrationManager } from "../GmailIntegration";
import { SlackIntegrationManager } from "../SlackIntegration";

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
    new SlackIntegrationManager(),
    new FigmaIntegrationManager(),
    new GithubIntegrationManager(),
]


