import type { GoogleSearchConsoleIntegration, GoogleSearchConsoleSitesResponse } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput } from "../IntegrationModule.js"
import { type ResourceClassContext, buildResourceClassContext, buildSkillToolType } from "../moduleHelpers.js"

const DOMAIN_PROPERTY_PREFIX = "sc-domain:"

export class GoogleSearchConsoleModule extends IntegrationModule<GoogleSearchConsoleInstanceData, GoogleSearchConsoleSectionContext> {
    readonly type = IntegrationType.GOOGLE_SEARCH_CONSOLE
    readonly summaryLabel = "Google Search Console"
    protected readonly sectionImports = ["GoogleSearchConsoleOutputConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<GoogleSearchConsoleInstanceData[]> {
        const instances = await fetchWithAuth<GoogleSearchConsoleIntegration[]>(ApiRoutes.GOOGLE_SEARCH_CONSOLE.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<GoogleSearchConsoleInstanceData> => {
                const response = await fetchWithAuth<GoogleSearchConsoleSitesResponse>(`${ApiRoutes.GOOGLE_SEARCH_CONSOLE.SITES}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                    sites: []
                }))
                return {
                    id: inst.id,
                    displayName: inst.email || inst.id,
                    sites: (response.sites ?? []).map(site => ({ ...site, label: toSiteLabel(site.siteUrl) }))
                }
            })
        )
    }

    instanceId(instance: GoogleSearchConsoleInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Google Search Console — read Search Analytics and manage the given properties */", "    googleSearchConsole: googleSearchConsoleSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<GoogleSearchConsoleInstanceData>): GoogleSearchConsoleSectionContext {
        const inst = this.requireInstance(input)
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            siteClass: buildResourceClassContext(
                "GoogleSearchConsoleSite",
                [
                    { classField: "siteUrl", type: "string", sourceField: "siteUrl" },
                    { classField: "permissionLevel", type: "string", sourceField: "permissionLevel" }
                ],
                "label",
                inst.sites
            )
        }
    }
}

/** Properties have no title in Search Console, so name the generated statics after the host. */
function toSiteLabel(siteUrl: string): string {
    if (siteUrl.toLowerCase().startsWith(DOMAIN_PROPERTY_PREFIX)) {
        return `domain ${siteUrl.slice(DOMAIN_PROPERTY_PREFIX.length)}`
    }
    try {
        const parsed = new URL(siteUrl)
        return `${parsed.hostname}${parsed.pathname.replace(/\/$/, "")}`
    } catch {
        return siteUrl
    }
}

export interface GoogleSearchConsoleInstanceData {
    id: string
    displayName: string
    sites: Array<{ siteUrl: string; permissionLevel: string; label: string }>
}

export interface GoogleSearchConsoleSectionContext {
    id: string
    skillToolType: string
    siteClass: ResourceClassContext
}
