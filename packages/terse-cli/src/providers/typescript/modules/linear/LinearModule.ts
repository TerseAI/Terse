import type { LinearIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class LinearModule extends IntegrationModule<LinearInstanceData, LinearSectionContext> {
    readonly type = IntegrationType.LINEAR
    readonly summaryLabel = "Linear"
    protected readonly sectionImports = ["LinearInputConfig", "LinearOutputConfig", "TypedSkill", "TypedTrigger", "LinearEventType"]

    async fetchInstances(apiKey: string): Promise<LinearInstanceData[]> {
        const instances = await fetchWithAuth<LinearIntegration[]>(ApiRoutes.LINEAR.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<LinearInstanceData> => {
                const teams = await fetchWithAuth<Array<{ id: string; name: string; key: string }>>(`${ApiRoutes.LINEAR.TEAMS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(
                    () => [] as Array<{ id: string; name: string; key: string }>
                )
                const projects = await fetchWithAuth<Array<{ id: string; name: string; description?: string; teamId: string }>>(
                    `${ApiRoutes.LINEAR.PROJECTS}?integrationId=${encodeURIComponent(inst.id)}`,
                    apiKey
                ).catch(() => [] as Array<{ id: string; name: string; description?: string; teamId: string }>)
                return {
                    id: inst.id,
                    displayName: inst.workspaceName || inst.id,
                    teams: Array.isArray(teams) ? teams : [],
                    projects: Array.isArray(projects) ? projects : []
                }
            })
        )
    }

    instanceId(instance: LinearInstanceData): string {
        return instance.id
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    linear: linearTriggers,"]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Linear — read and write issues, optionally scoped to a team or project */", "    linear: linearSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<LinearInstanceData>): LinearSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            teamClass: buildResourceClassContext(
                "LinearTeam",
                [
                    { classField: "teamId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" },
                    { classField: "key", type: "string", sourceField: "key" }
                ],
                "name",
                inst.teams
            ),
            projectClass: buildResourceClassContext(
                "LinearProject",
                [
                    { classField: "projectId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.projects
            )
        }
    }
}

export interface LinearInstanceData {
    id: string
    displayName: string
    teams: Array<{ id: string; name: string; key: string }>
    projects: Array<{ id: string; name: string; description?: string; teamId: string }>
}

export interface LinearSectionContext {
    id: string
    skillToolType: string
    teamClass: ResourceClassContext
    projectClass: ResourceClassContext
}
