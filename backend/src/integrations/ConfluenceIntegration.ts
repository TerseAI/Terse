import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { ConfluenceIntegration } from "../shared/types";
import { IntegrationType } from "@prisma/client";

export class ConfluenceIntegrationManager implements Integration<ConfluenceIntegration, never> {
    constructor() { }

    getIntegrationType(): IntegrationType {
        return IntegrationType.CONFLUENCE;
    }

    async getInstancesForUser(userId: string): Promise<ConfluenceIntegration[]> {
        // Confluence uses the same credentials as Jira
        const jiraKeys = await db().jira_api_keys.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                jira_user_email: true,
                base_url: true,
            }
        });
        return jiraKeys.map(jk => ({
            id: jk.id,
            confluence_user_email: jk.jira_user_email,
            base_url: jk.base_url,
        }));
    }

    async processWebhookEvent(event: never): Promise<void> {
        // Confluence webhooks are handled elsewhere
        throw new Error("Confluence webhooks are not processed through this integration manager");
    }
}

