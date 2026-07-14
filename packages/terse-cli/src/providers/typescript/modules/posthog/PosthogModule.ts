import { log } from "@clack/prompts"
import type { PosthogIntegration, ToolDefinition } from "terse-types"
import { ApiRoutes, IntegrationType, posthogProjectEventsResponseSchema } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput, type ToolParamsPrintOptions } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class PosthogModule extends IntegrationModule<PosthogInstanceData, PosthogSectionContext> {
    readonly type = IntegrationType.POSTHOG
    readonly summaryLabel = "PostHog"
    protected readonly sectionImports = ["PosthogConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<PosthogInstanceData[]> {
        const instances = await fetchWithAuth<PosthogIntegration[]>(ApiRoutes.POSTHOG.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<PosthogInstanceData> => {
                const resp = await fetchWithAuth<{ projects: Array<{ id: string; name: string }> }>(`${ApiRoutes.POSTHOG.PROJECTS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                    projects: []
                }))
                const projects = await Promise.all(
                    (resp.projects || []).map(async project => {
                        const events = await fetchPosthogProjectEventNames(inst.id, project.id, apiKey)
                        return { ...project, events }
                    })
                )
                return { id: inst.id, displayName: inst.orgName || inst.email || inst.id, projects }
            })
        )
    }

    instanceId(instance: PosthogInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** PostHog — query analytics for a specific project */", "    posthog: posthogSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<PosthogInstanceData>): PosthogSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            projectClass: buildResourceClassContext(
                "PosthogProject",
                [
                    { classField: "projectId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.projects
            ),
            eventNames: [...new Set(inst.projects.flatMap(project => project.events))]
        }
    }

    protected toolParamsPrintOptions(tool: ToolDefinition, input: ModuleRenderInput<PosthogInstanceData>): ToolParamsPrintOptions {
        const hasEventNames = (input.instances[0]?.projects ?? []).some(project => project.events.length > 0)
        if (tool.name === "searchPosthogEvents" && hasEventNames) {
            // Custom events type-check against the generated union; $-prefixed builtins are always allowed
            return { fieldOverrides: { eventName: "PosthogEventName | `$${string}` | null" } }
        }
        return {}
    }
}

async function fetchPosthogProjectEventNames(integrationId: string, projectId: string, apiKey: string): Promise<string[]> {
    try {
        const raw = await fetchWithAuth<unknown>(`${ApiRoutes.POSTHOG.EVENTS}?integrationId=${encodeURIComponent(integrationId)}&projectId=${encodeURIComponent(projectId)}`, apiKey)
        return posthogProjectEventsResponseSchema.parse(raw).events.map(event => event.name)
    } catch {
        log.warn(`Could not fetch PostHog event names for project ${projectId}; eventName stays untyped until the next successful terse generate`)
        return []
    }
}

export interface PosthogInstanceData {
    id: string
    displayName: string
    projects: Array<{ id: string; name: string; events: string[] }>
}

export interface PosthogSectionContext {
    id: string
    skillToolType: string
    projectClass: ResourceClassContext
    eventNames: string[]
}
