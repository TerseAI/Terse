import type { WorkOSIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { type IntegrationInstanceData, IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { buildSkillToolType } from "../moduleHelpers.js"

export class WorkOSModule extends IntegrationModule<IntegrationInstanceData, WorkOSSectionContext> {
    readonly type = IntegrationType.WORKOS
    readonly summaryLabel = "WorkOS"
    protected readonly sectionImports = ["WorkOSInputConfig", "WorkOSOutputConfig", "WorkOSEventType", "TypedSkill", "TypedTrigger"]

    async fetchInstances(apiKey: string): Promise<IntegrationInstanceData[]> {
        const instances = await fetchWithAuth<WorkOSIntegration[]>(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, apiKey)
        return instances.map(inst => ({ id: inst.id, displayName: inst.environment || inst.id }))
    }

    instanceId(instance: IntegrationInstanceData): string {
        return instance.id
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    workOS: workOSTriggers,"]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** WorkOS — manage users, organizations and invitations */", "    workOS: workOSSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<IntegrationInstanceData>): WorkOSSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools)
        }
    }
}

export interface WorkOSSectionContext {
    id: string
    skillToolType: string
}
