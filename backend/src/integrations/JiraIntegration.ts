import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { JiraIntegration } from "../shared/types";
import { IntegrationType } from "@prisma/client";

export class JiraIntegrationManager implements Integration<JiraIntegration, never> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.JIRA;

    async getInstancesForUser(userId: string): Promise<JiraIntegration[]> {
        const jiraKeys = await db().jira_api_keys.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                base_url: true,
                site_name: true,
                project_key: true,
                project_name: true,
                jira_user_email: true,
            }
        });
        return jiraKeys.map(jk => ({
            id: jk.id,
            baseUrl: jk.base_url,
            email: jk.jira_user_email,
            siteName: jk.site_name || undefined,
            projectKey: jk.project_key || undefined,
            projectName: jk.project_name || undefined,
        }));
    }

    async processWebhookEvent(event: never): Promise<void> {
        // Jira webhooks are handled elsewhere
        throw new Error("Jira webhooks are not processed through this integration manager");
    }
}

