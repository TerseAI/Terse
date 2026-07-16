import type { ApolloIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { buildSkillToolType } from "../moduleHelpers.js"

export class ApolloModule extends IntegrationModule<ApolloInstanceData, ApolloSectionContext> {
    readonly type = IntegrationType.APOLLO
    readonly summaryLabel = "Apollo"
    protected readonly sectionImports = ["ApolloOutputConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<ApolloInstanceData[]> {
        const instances = await fetchWithAuth<ApolloIntegration[]>(ApiRoutes.APOLLO.INTEGRATIONS, apiKey)
        return instances.map(inst => ({ id: inst.id, displayName: "Apollo" }))
    }

    instanceId(instance: ApolloInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Apollo — enrich people and companies and search for prospects */", "    apollo: apolloSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<ApolloInstanceData>): ApolloSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools)
        }
    }
}

export interface ApolloInstanceData {
    id: string
    displayName: string
}

export interface ApolloSectionContext {
    id: string
    skillToolType: string
}
