

// Alternative: More direct approach using Prisma's type system

import { gmail_integrations } from "@prisma/client";
import { db } from "src/prismaClient";
import { GmailIntegrationManager } from "./GmailIntegration";

// This ensures T is a valid Prisma model type
export interface Integration<T, WebhookEvent> {
    getInstancesForUser(userId: string): Promise<T[]>;
    processWebhookEvent(event: WebhookEvent): Promise<void>;
}


export const IntegrationRegistry: Integration<any, any>[] = [
    new GmailIntegrationManager(),
]


