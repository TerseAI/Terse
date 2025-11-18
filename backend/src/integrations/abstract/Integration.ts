import { FigmaIntegrationManager } from "../FigmaIntegration";
import { GithubIntegrationManager } from "../GithubIntegration";
import { GmailIntegrationManager } from "../GmailIntegration";
import { SlackIntegrationManager } from "../SlackIntegration";
import { IntegrationType } from "@prisma/client";
import { AutomationInputWithConfigs } from "../../types/prisma";

// This ensures T is a valid Prisma model type
export interface Integration<T, WebhookEvent> {
    getInstancesForUser(userId: string): Promise<T[]>;
    processWebhookEvent(event: WebhookEvent): Promise<void>;
    getIntegrationType(): IntegrationType;

    // Optional setup/teardown methods for integrations that need them
    setupIntegration?(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void>;
    teardownIntegration?(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void>;

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
