import type { LaunchDarklyIntegration } from "terse-types"
import { ApiRoutes, IntegrationType, buildRoute } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class LaunchDarklyModule extends IntegrationModule<LaunchDarklyInstanceData, LaunchDarklySectionContext> {
    readonly type = IntegrationType.LAUNCHDARKLY
    readonly summaryLabel = "LaunchDarkly"
    protected readonly sectionImports = ["LaunchDarklyConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<LaunchDarklyInstanceData[]> {
        const instances = await fetchWithAuth<LaunchDarklyIntegration[]>(ApiRoutes.LAUNCHDARKLY.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<LaunchDarklyInstanceData> => {
                const resp = await fetchWithAuth<{ projects: Array<{ key: string; name: string }> }>(
                    buildRoute(ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID, { integrationId: inst.id }),
                    apiKey
                ).catch(() => ({ projects: [] }))
                return { id: inst.id, displayName: inst.tokenName || inst.email || inst.id, projects: resp.projects || [] }
            })
        )
    }

    instanceId(instance: LaunchDarklyInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** LaunchDarkly — read and toggle feature flags in a project + environments */", "    launchDarkly: launchDarklySkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<LaunchDarklyInstanceData>): LaunchDarklySectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            projectClass: buildResourceClassContext(
                "LaunchDarklyProject",
                [
                    { classField: "projectKey", type: "string", sourceField: "key" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.projects
            )
        }
    }
}

export interface LaunchDarklyInstanceData {
    id: string
    displayName: string
    projects: Array<{ key: string; name: string }>
}

export interface LaunchDarklySectionContext {
    id: string
    skillToolType: string
    projectClass: ResourceClassContext
}
