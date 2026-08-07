import { IntegrationType } from "terse-types"
import type { ConfigData, SerializedEvent, Trigger } from "terse-types"
import type { z } from "zod"

import { getEventTransform } from "./context.js"

export { registerEventTransform } from "./context.js"

/**
 * Lightweight interface for toolbox entries.
 * The backend's concrete ToolboxEntry (which depends on @openai/agents Tool) structurally satisfies this interface.
 */
export interface ToolboxEntry {
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
}

export type TriggerLike = { integrationType: string; eventType: string }

export type SDKTrigger<TEvent extends TriggerLike = Trigger> = TEvent & {
    triggeredAt: Date
    formatForAgentRunner(): string
    debugLog(): string
}

export type InferStructuredOutput<TSchema, TFallback = string> = TSchema extends { _output: infer TOutput } ? TOutput : TFallback

export function createSDKTrigger(serialized: SerializedEvent): SDKTrigger {
    const integrationType = (serialized.data as { integrationType?: string }).integrationType
    const transform = integrationType ? getEventTransform(integrationType) : undefined
    const data = transform ? transform(serialized.data) : serialized.data
    return Object.assign({}, data, {
        triggeredAt: new Date(serialized.triggeredAt),
        formatForAgentRunner: () => serialized.formattedContent,
        debugLog: () => serialized.debugLog
    }) as SDKTrigger
}

// ---------------------------------------------------------------------------
// TypedTrigger – phantom-typed ConfigData for generic event inference
// ---------------------------------------------------------------------------

export type TypedTrigger<TEvent extends TriggerLike = Trigger> = ConfigData & {
    readonly __eventType?: TEvent
}

export type InferEvent<T> = T extends TypedTrigger<infer E> ? SDKTrigger<E> : SDKTrigger
export type InferEvents<T extends readonly unknown[]> = InferEvent<T[number]>

// ---------------------------------------------------------------------------
// TypedSkill – phantom-typed ConfigData for skill tool inference
// ---------------------------------------------------------------------------

export type TypedSkill<TToolName extends string = never> = ConfigData & {
    readonly __toolApprovalNames?: TToolName
}

export type InferToolApproval<T> = T extends TypedSkill<infer TToolName> ? TToolName : never
export type InferToolApprovals<T extends readonly unknown[]> = InferToolApproval<T[number]>

// ---------------------------------------------------------------------------
// State – typed per-job key/value store, narrowed to the declared `states` keys
// ---------------------------------------------------------------------------

export type StateDefinition<K extends string = string, S extends z.ZodType = z.ZodType> = {
    key: K
    value: S
}

// A key whose schema carries a `.default(...)` can never read back as undefined; one without a default can
// (it may have been never set). `get` reflects that per key; `set` returns the value it just wrote.
type Read<S extends z.ZodType> = S extends z.ZodDefault<z.ZodTypeAny> ? z.infer<S> : z.infer<S> | undefined

type StateReads<TStates extends readonly StateDefinition[]> = {
    [S in TStates[number] as S["key"]]: Read<S["value"]>
}

type StateWrites<TStates extends readonly StateDefinition[]> = {
    [S in TStates[number] as S["key"]]: z.infer<S["value"]>
}

export type StateAccessor<TStates extends readonly StateDefinition[]> = {
    get<K extends keyof StateReads<TStates> & string>(key: K): Promise<StateReads<TStates>[K]>
    set<K extends keyof StateWrites<TStates> & string>(key: K, value: StateWrites<TStates>[K]): Promise<StateWrites<TStates>[K]>
}
