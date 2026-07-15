import type { z } from "zod"

import type { IntegrationType } from "./Integrations"

export function defineTrigger<S extends z.ZodType>(definition: Omit<ConcreteTriggerDefinition<S>, "kind">): ConcreteTriggerDefinition<S> {
    return { kind: "concrete", ...definition }
}

export function defineTriggerUnion(definition: Omit<UnionTriggerDefinition, "kind">): UnionTriggerDefinition {
    return { kind: "union", ...definition }
}

export interface TriggerDisplay {
    title: string
    subtitle: string
}

export type TriggerPrintHints = {
    readonly typeParams?: string
    readonly aliasArgs?: string
    readonly fieldOverrides?: Readonly<Record<string, string>>
    readonly imports?: readonly string[]
}

// Method syntax (not arrow properties) is deliberate: it keeps parameters bivariant so
// per-definition presenters remain assignable to the type-erased dispatch registry.
export type TriggerPresenter<T> = {
    formatForAgent(trigger: T): string
    debug(trigger: T): string
    display(trigger: T): TriggerDisplay
}

export type ConcreteTriggerDefinition<S extends z.ZodType = z.ZodType> = {
    readonly kind: "concrete"
    readonly integration: IntegrationType
    readonly schema: S
    readonly eventTypes: readonly string[]
    readonly printHints?: TriggerPrintHints
    readonly presenter?: TriggerPresenter<z.infer<S>>
}

export type UnionTriggerDefinition = {
    readonly kind: "union"
    readonly integration: IntegrationType
    readonly members: readonly string[]
    readonly presenter?: TriggerPresenter<unknown>
}

export type TriggerDefinition = ConcreteTriggerDefinition | UnionTriggerDefinition
