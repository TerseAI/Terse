/**
 * ACL and readOnly are model-run controls.
 *
 * They affect only the OpenAI tool list and tool input guardrails used for model-selected tool calls
 * during agent runs. They do not affect deterministic developer-authored tool execution paths.
 */
import type { ACLRule, ConfigData } from "terse-types"
import { getMergedACLRules } from "terse-types"

import { type HydrateACLRulesOptions, getHydratedACLRules } from "./getHydratedACLRules"

export type { HydrateACLRulesOptions } from "./getHydratedACLRules"

/**
 * Builds a flat `ACLRule[]` for one agent run: Phase-1 merged config rules plus backend hydration.
 *
 * Pass `{ userId }` when available so GitHub `repositoryIds` can be resolved to normalized owner/repo
 * names for repository ACL rules.
 */
export async function buildRunACLRules(configs: ConfigData[], hydrateOptions?: HydrateACLRulesOptions): Promise<ACLRule[]> {
    const baseRules = getMergedACLRules(configs)
    const hydratedRules = await getHydratedACLRules(configs, hydrateOptions)

    return [...baseRules, ...hydratedRules]
}
