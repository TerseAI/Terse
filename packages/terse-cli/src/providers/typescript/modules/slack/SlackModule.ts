import type { SlackIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class SlackModule extends IntegrationModule<SlackInstanceData, SlackSectionContext> {
    readonly type = IntegrationType.SLACK
    readonly summaryLabel = "Slack"
    protected readonly sectionImports = ["SlackConfig", "SlackOutputConfig", "TypedSkill", "SlackEventType", "TypedTrigger"]

    async fetchInstances(apiKey: string): Promise<SlackInstanceData[]> {
        const instances = await fetchWithAuth<SlackIntegration[]>(ApiRoutes.SLACK.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<SlackInstanceData> => {
                const [channelsResp, usersResp] = await Promise.all([
                    fetchWithAuth<{ channels: Array<{ id: string; name: string }> }>(`${ApiRoutes.SLACK.CHANNELS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                        channels: []
                    })),
                    fetchWithAuth<{ users: Array<{ id: string; name: string }> }>(`${ApiRoutes.SLACK.USERS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({ users: [] }))
                ])
                return {
                    id: inst.id,
                    displayName: inst.teamName || inst.id,
                    channels: channelsResp.channels || [],
                    users: usersResp.users || []
                }
            })
        )
    }

    instanceId(instance: SlackInstanceData): string {
        return instance.id
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    slack: slackTriggers,"]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Slack — send messages and manage threads in a specific channel */", "    slack: slackSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<SlackInstanceData>): SlackSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            channelClass: buildResourceClassContext(
                "SlackChannel",
                [
                    { classField: "channelId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.channels
            ),
            userClass: buildResourceClassContext(
                "SlackUser",
                [
                    { classField: "userId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.users
            )
        }
    }
}

export interface SlackInstanceData {
    id: string
    displayName: string
    channels: Array<{ id: string; name: string }>
    users: Array<{ id: string; name: string }>
}

export interface SlackSectionContext {
    id: string
    skillToolType: string
    channelClass: ResourceClassContext
    userClass: ResourceClassContext
}
