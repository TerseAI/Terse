import type { HiggsfieldIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { buildSkillToolType } from "../moduleHelpers.js"

export class HiggsfieldModule extends IntegrationModule<HiggsfieldInstanceData, HiggsfieldSectionContext> {
    readonly type = IntegrationType.HIGGSFIELD
    readonly summaryLabel = "Higgsfield"
    protected readonly sectionImports = ["HiggsfieldOutputConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<HiggsfieldInstanceData[]> {
        const instances = await fetchWithAuth<HiggsfieldIntegration[]>(ApiRoutes.HIGGSFIELD.INTEGRATIONS, apiKey)
        return instances.map(inst => ({ id: inst.id, displayName: "Higgsfield" }))
    }

    instanceId(instance: HiggsfieldInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Higgsfield — generate ad creative images from a text prompt */", "    higgsfield: higgsfieldSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<HiggsfieldInstanceData>): HiggsfieldSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools)
        }
    }
}

export interface HiggsfieldInstanceData {
    id: string
    displayName: string
}

export interface HiggsfieldSectionContext {
    id: string
    skillToolType: string
}
