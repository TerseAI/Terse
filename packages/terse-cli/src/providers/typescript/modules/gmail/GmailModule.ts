import type { GmailIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { type IntegrationInstanceData, IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { buildSkillToolType } from "../moduleHelpers.js"

export class GmailModule extends IntegrationModule<IntegrationInstanceData, GmailSectionContext> {
    readonly type = IntegrationType.GMAIL
    readonly summaryLabel = "Gmail"
    protected readonly sectionImports = ["GmailConfig", "GmailOutputConfig", "GmailDraftOutputConfig", "TypedSkill", "TypedTrigger", "GmailEventType"]

    async fetchInstances(apiKey: string): Promise<IntegrationInstanceData[]> {
        const instances = await fetchWithAuth<GmailIntegration[]>(ApiRoutes.GMAIL.INTEGRATIONS, apiKey)
        return instances.map(inst => ({ id: inst.id, displayName: inst.email || inst.id }))
    }

    instanceId(instance: IntegrationInstanceData): string {
        return instance.id
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    gmail: gmailTriggers,"]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Gmail — send emails */", "    gmail: gmailSkill,", "    /** Gmail — create draft emails (no auto-send) */", "    gmailDraft: gmailDraftSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<IntegrationInstanceData>): GmailSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools)
        }
    }
}

export interface GmailSectionContext {
    id: string
    skillToolType: string
}
