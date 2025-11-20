import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { AtlassianIntegration, AtlassianIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";

export class AtlassianIntegrationManager implements Integration<AtlassianIntegration, never, typeof AtlassianIntegrationMetadata> {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN;
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

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {
        // Atlassian doesn't require any setup for automation inputs
        // Webhooks are managed at the integration level
    }

    async teardownChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {
        // Atlassian doesn't require any teardown for automation inputs
        // Webhooks are managed at the integration level
    }
}

