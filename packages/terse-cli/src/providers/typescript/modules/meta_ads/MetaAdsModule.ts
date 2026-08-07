import type { MetaAdsAdAccount, MetaAdsIntegration } from "terse-types"
import { ApiRoutes, IntegrationType, buildRoute } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

export class MetaAdsModule extends IntegrationModule<MetaAdsInstanceData, MetaAdsSectionContext> {
    readonly type = IntegrationType.META_ADS
    readonly summaryLabel = "Meta Ads"
    protected readonly sectionImports = ["MetaAdsOutputConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<MetaAdsInstanceData[]> {
        const instances = await fetchWithAuth<MetaAdsIntegration[]>(ApiRoutes.META_ADS.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<MetaAdsInstanceData> => {
                const adAccounts = await fetchWithAuth<MetaAdsAdAccount[]>(buildRoute(ApiRoutes.META_ADS.AD_ACCOUNTS, { integrationId: inst.id }), apiKey).catch(() => [] as MetaAdsAdAccount[])
                return { id: inst.id, displayName: inst.accountName || inst.id, adAccounts }
            })
        )
    }

    instanceId(instance: MetaAdsInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Meta Ads — read campaign performance, sync custom audiences, send offline conversions */", "    metaAds: metaAdsSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<MetaAdsInstanceData>): MetaAdsSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            adAccountClass: buildResourceClassContext(
                "MetaAdsAdAccount",
                [
                    { classField: "accountId", type: "string", sourceField: "accountId" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.adAccounts
            )
        }
    }
}

export interface MetaAdsInstanceData {
    id: string
    displayName: string
    adAccounts: MetaAdsAdAccount[]
}

export interface MetaAdsSectionContext {
    id: string
    skillToolType: string
    adAccountClass: ResourceClassContext
}
