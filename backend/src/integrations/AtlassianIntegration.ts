import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { AtlassianIntegration, AtlassianIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "@prisma/client";

export class AtlassianIntegrationManager implements Integration<AtlassianIntegration, never, typeof AtlassianIntegrationMetadata> {
    integrationType: IntegrationType = IntegrationType.CONFLUENCE;
    constructor() { }

    async getInstancesForUser(userId: string): Promise<AtlassianIntegration[]> {
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
            email: jk.jira_user_email,
            baseUrl: jk.base_url,
        }));
    }

    async processWebhookEvent(event: never): Promise<void> {
        // Confluence webhooks are handled elsewhere
        throw new Error("Confluence webhooks are not processed through this integration manager");
    }
}

