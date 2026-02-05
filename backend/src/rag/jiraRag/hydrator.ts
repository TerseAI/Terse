import { JiraEvent } from "../../integrations/AtlassianIntegration"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { IntegrationType } from "../../shared/Integrations"
import { HydratorType } from "../../types/rag"
import { JiraWebhookPayload } from "../../utility/JiraWebhookPayload"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class JiraEventHydrator extends Hydrator<JiraEvent> {
    readonly entityType = HydratorType.JIRA_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<JiraEvent> {
        const event = await this.fetchFromJira(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate Jira event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<JiraEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromJira(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Jira event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromJira(entityId: string): Promise<JiraEvent | null> {
        const parts = entityId.split(":")
        if (parts.length < 2) {
            logger.error(`Invalid Jira entityId format: ${entityId}`)
            return null
        }
        const [integrationId, issueKey] = parts

        const integration = await db().atlassian_integrations.findFirst({
            where: {
                id: integrationId,
                ...(this.ctx.organizationId && { organization_id: this.ctx.organizationId })
            }
        })
        if (!integration?.cloud_id) {
            logger.error(`Jira integration ${integrationId} not found or missing cloud_id`)
            return null
        }

        const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === IntegrationType.ATLASSIAN)
        if (!manager || !isOAuthIntegrationInstallation(manager)) {
            return null
        }
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            logger.error(`Could not get Jira access token for ${integrationId}`)
            return null
        }

        try {
            const issueResponse = await fetch(`https://api.atlassian.com/ex/jira/${integration.cloud_id}/rest/api/3/issue/${issueKey}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            })
            if (!issueResponse.ok) {
                logger.error(`Jira issue ${issueKey} not found or inaccessible`, { status: issueResponse.status })
                return null
            }
            const issue = await issueResponse.json()

            const payload: JiraWebhookPayload = {
                timestamp: Date.now(),
                webhookEvent: "jira:issue_updated",
                user: {
                    self: issue.fields?.reporter?.self ?? "",
                    name: issue.fields?.reporter?.name ?? "Unknown",
                    key: issue.fields?.reporter?.key ?? "unknown",
                    emailAddress: issue.fields?.reporter?.emailAddress ?? "",
                    avatarUrls: issue.fields?.reporter?.avatarUrls ?? { "16x16": "", "24x24": "", "32x32": "", "48x48": "" },
                    displayName: issue.fields?.reporter?.displayName ?? "Unknown",
                    active: true
                },
                issue
            }
            return new JiraEvent(payload, integrationId)
        } catch (error) {
            logger.error(`Failed to fetch Jira issue ${issueKey}`, { error, entityId })
            return null
        }
    }
}
