import type { ACLRule, ConfigData } from "terse-types"
import { getMergedACLRules } from "terse-types"

import { type HydrateACLRulesOptions, getHydratedACLRules } from "./getHydratedACLRules"

export type { HydrateACLRulesOptions } from "./getHydratedACLRules"

export async function buildRunACLRules(configs: ConfigData[], hydrateOptions?: HydrateACLRulesOptions): Promise<ACLRule[]> {
    const baseRules = getMergedACLRules(configs)
    const hydratedRules = await getHydratedACLRules(configs, hydrateOptions)

    return [...baseRules, ...hydratedRules]
}
