import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { NotionIntegration } from "../shared/types";
import { IntegrationType } from "@prisma/client";

export class NotionIntegrationManager implements Integration<NotionIntegration, never> {
    constructor() { }

    getIntegrationType(): IntegrationType {
        return IntegrationType.NOTION;
    }

    async getInstancesForUser(userId: string): Promise<NotionIntegration[]> {
        const notionIntegrations = await db().notion_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
            }
        });
        return notionIntegrations.map(ni => ({
            id: ni.id,
            workspaceId: ni.workspace_id || undefined,
            workspaceName: ni.workspace_name || undefined,
        }));
    }

    async processWebhookEvent(event: never): Promise<void> {
        // Notion webhooks are handled elsewhere
        throw new Error("Notion webhooks are not processed through this integration manager");
    }
}

