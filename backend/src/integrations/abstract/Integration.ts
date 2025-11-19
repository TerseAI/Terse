import { IntegrationType } from "@prisma/client";
import { OAuthInstallationDetails } from "../../shared/types";
import { IntegrationInstance, IntegrationDetails } from "../../shared/Integrations";
import { Request, Response } from "express";

// This ensures T is a valid Prisma model type
export interface Integration<T extends IntegrationInstance, W, M extends IntegrationDetails>  {
    integrationType: IntegrationType;
    getInstancesForUser(userId: string): Promise<T[]>;
    processWebhookEvent(event: W): Promise<void>;
    deleteInstallation(integrationId: string): Promise<void>;
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