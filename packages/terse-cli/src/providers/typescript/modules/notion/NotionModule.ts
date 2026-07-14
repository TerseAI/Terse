import type { NotionIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class NotionModule extends IntegrationModule<NotionInstanceData, NotionSectionContext> {
    readonly type = IntegrationType.NOTION
    readonly summaryLabel = "Notion"
    protected readonly sectionImports = ["NotionConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<NotionInstanceData[]> {
        const instances = await fetchWithAuth<NotionIntegration[]>(ApiRoutes.NOTION.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<NotionInstanceData> => {
                const resp = await fetchWithAuth<{ resources: Array<{ id: string; title: string; type: string }> }>(
                    `${ApiRoutes.NOTION.RESOURCES}?integrationId=${encodeURIComponent(inst.id)}`,
                    apiKey
                ).catch(() => ({ resources: [] }))
                const resources = resp.resources || []
                return {
                    id: inst.id,
                    displayName: inst.workspaceName || inst.id,
                    databases: resources.filter(r => r.type === "database"),
                    pages: resources.filter(r => r.type === "page")
                }
            })
        )
    }

    instanceId(instance: NotionInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Notion — read and write to the given databases or pages */", "    notion: notionSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<NotionInstanceData>): NotionSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            databaseClass: buildResourceClassContext(
                "NotionDatabase",
                [
                    { classField: "databaseId", type: "string", sourceField: "id" },
                    { classField: "title", type: "string", sourceField: "title" }
                ],
                "title",
                inst.databases
            ),
            pageClass: buildResourceClassContext(
                "NotionPage",
                [
                    { classField: "pageId", type: "string", sourceField: "id" },
                    { classField: "title", type: "string", sourceField: "title" }
                ],
                "title",
                inst.pages
            )
        }
    }
}

export interface NotionInstanceData {
    id: string
    displayName: string
    databases: Array<{ id: string; title: string; type: string }>
    pages: Array<{ id: string; title: string; type: string }>
}

export interface NotionSectionContext {
    id: string
    skillToolType: string
    databaseClass: ResourceClassContext
    pageClass: ResourceClassContext
}
