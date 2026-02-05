import { LinearClient } from "@linear/sdk"

import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import { LinearEvent } from "../../integrations/LinearIntegration"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { IntegrationType } from "../../shared/Integrations"
import { HydratorType } from "../../types/rag"
import { LinearWebhookPayload } from "../../utility/LinearWebhookPayload"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class LinearEventHydrator extends Hydrator<LinearEvent> {
    readonly entityType = HydratorType.LINEAR_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<LinearEvent> {
        const event = await this.fetchFromLinear(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate Linear event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<LinearEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromLinear(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Linear event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromLinear(entityId: string): Promise<LinearEvent | null> {
        const parts = entityId.split(":")
        if (parts.length < 2) {
            logger.error(`Invalid Linear entityId format: ${entityId}`)
            return null
        }
        const [integrationId, issueId] = parts

        const integration = await db().linear_integrations.findFirst({
            where: {
                id: integrationId,
                ...(this.ctx.organizationId && { organization_id: this.ctx.organizationId })
            }
        })
        if (!integration) {
            logger.error(`Linear integration ${integrationId} not found for user`)
            return null
        }

        const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === IntegrationType.LINEAR)
        if (!manager || !isOAuthIntegrationInstallation(manager)) {
            return null
        }
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            logger.error(`Could not get Linear access token for ${integrationId}`)
            return null
        }

        try {
            const client = new LinearClient({ apiKey: accessToken })
            const issue = await client.issue(issueId)
            if (!issue) {
                logger.error(`Linear issue ${issueId} not found`)
                return null
            }

            const state = await issue.state
            const team = await issue.team
            const payload: LinearWebhookPayload = {
                action: "update",
                actor: {
                    id: (await issue.creator)?.id ?? "",
                    name: (await issue.creator)?.name ?? "Unknown",
                    email: (await issue.creator)?.email ?? "",
                    url: "",
                    type: "user"
                },
                createdAt: issue.createdAt.toISOString(),
                data: {
                    id: issue.id,
                    createdAt: issue.createdAt.toISOString(),
                    updatedAt: issue.updatedAt.toISOString(),
                    number: issue.number ?? 0,
                    title: issue.title,
                    priority: 0,
                    sortOrder: 0,
                    prioritySortOrder: 0,
                    slaType: "",
                    addedToTeamAt: issue.createdAt.toISOString(),
                    trashed: false,
                    labelIds: [],
                    teamId: team?.id ?? "",
                    previousIdentifiers: [],
                    stateId: state?.id ?? "",
                    reactionData: [],
                    priorityLabel: "None",
                    identifier: issue.identifier ?? "",
                    url: issue.url ?? "",
                    subscriberIds: [],
                    state: state
                        ? {
                              id: state.id,
                              color: state.color ?? "",
                              name: state.name ?? "Unknown",
                              type: state.type ?? "unstarted"
                          }
                        : { id: "", color: "", name: "Unknown", type: "unstarted" },
                    team: team
                        ? { id: team.id, key: team.key ?? "", name: team.name ?? "Unknown" }
                        : { id: "", key: "", name: "Unknown" },
                    labels: [],
                    description: issue.description ?? undefined
                },
                type: "Issue",
                organizationId: "",
                webhookTimestamp: Date.now(),
                webhookId: ""
            }
            if (issue.assignee) {
                const assignee = await issue.assignee
                if (assignee) {
                    payload.data.assignee = { id: assignee.id, name: assignee.name ?? "Unknown" }
                }
            }

            return new LinearEvent(payload, integrationId)
        } catch (error) {
            logger.error(`Failed to fetch Linear issue ${issueId}`, { error, entityId })
            return null
        }
    }
}
