import type { DatadogIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class DatadogModule extends IntegrationModule<DatadogInstanceData, DatadogSectionContext> {
    readonly type = IntegrationType.DATADOG
    readonly summaryLabel = "Datadog"
    protected readonly sectionImports = ["DatadogConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<DatadogInstanceData[]> {
        const instances = await fetchWithAuth<DatadogIntegration[]>(ApiRoutes.DATADOG.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<DatadogInstanceData> => {
                const resp = await fetchWithAuth<{ indexes: Array<{ name: string }> }>(`${ApiRoutes.DATADOG.INDEXES}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                    indexes: []
                }))
                return { id: inst.id, displayName: inst.region || inst.id, indexes: resp.indexes || [] }
            })
        )
    }

    instanceId(instance: DatadogInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Datadog — search and analyze logs, optionally scoped to specific indexes */", "    datadog: datadogSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<DatadogInstanceData>): DatadogSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            indexClass: buildResourceClassContext("DatadogIndex", [{ classField: "name", type: "string", sourceField: "name" }], "name", inst.indexes)
        }
    }
}

export interface DatadogInstanceData {
    id: string
    displayName: string
    indexes: Array<{ name: string }>
}

export interface DatadogSectionContext {
    id: string
    skillToolType: string
    indexClass: ResourceClassContext
}
