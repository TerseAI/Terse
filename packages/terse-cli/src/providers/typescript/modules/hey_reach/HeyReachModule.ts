import type { HeyReachIntegration } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext } from "../moduleHelpers.js"

export class HeyReachModule extends IntegrationModule<HeyReachInstanceData, HeyReachSectionContext> {
    readonly type = IntegrationType.HEY_REACH
    readonly summaryLabel = "HeyReach"
    protected readonly sectionImports = ["HeyReachInputConfig", "HeyReachEventType", "TypedTrigger"]

    async fetchInstances(apiKey: string): Promise<HeyReachInstanceData[]> {
        const instances = await fetchWithAuth<HeyReachIntegration[]>(ApiRoutes.HEY_REACH.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<HeyReachInstanceData> => {
                const resp = await fetchWithAuth<{ campaigns: Array<{ id: string; name: string }> }>(`${ApiRoutes.HEY_REACH.CAMPAIGNS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(
                    () => ({ campaigns: [] })
                )
                return { id: inst.id, displayName: inst.id, campaigns: resp.campaigns || [] }
            })
        )
    }

    instanceId(instance: HeyReachInstanceData): string {
        return instance.id
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    heyReach: heyReachTriggers,"]
    }

    protected prepareSection(input: ModuleRenderInput<HeyReachInstanceData>): HeyReachSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            campaignClass: buildResourceClassContext(
                "HeyReachCampaign",
                [
                    { classField: "campaignId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.campaigns
            )
        }
    }
}

export interface HeyReachInstanceData {
    id: string
    displayName: string
    campaigns: Array<{ id: string; name: string }>
}

export interface HeyReachSectionContext {
    id: string
    campaignClass: ResourceClassContext
}
