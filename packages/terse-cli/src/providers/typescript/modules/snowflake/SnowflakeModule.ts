import type { SnowflakeIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { buildSkillToolType } from "../moduleHelpers.js"

export class SnowflakeModule extends IntegrationModule<SnowflakeInstanceData, SnowflakeSectionContext> {
    readonly type = IntegrationType.SNOWFLAKE
    readonly summaryLabel = "Snowflake"
    protected readonly sectionImports = ["SnowflakeOutputConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<SnowflakeInstanceData[]> {
        const instances = await fetchWithAuth<SnowflakeIntegration[]>(ApiRoutes.SNOWFLAKE.INTEGRATIONS, apiKey)
        return instances.map(inst => ({ id: inst.id, name: inst.accountIdentifier }))
    }

    instanceId(instance: SnowflakeInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Snowflake — run SQL queries against your warehouse */", "    snowflake: snowflakeSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<SnowflakeInstanceData>): SnowflakeSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools)
        }
    }
}

export interface SnowflakeInstanceData {
    id: string
    name: string
}

export interface SnowflakeSectionContext {
    id: string
    skillToolType: string
}
