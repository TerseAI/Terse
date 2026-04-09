import { GitHubEventType, IntegrationType, WorkOSEventType, debugTriggerEvent, formatTriggerEventForAgent, parseTriggerEvent } from "terse-types"
import type {
    ConfigData,
    GitHubPullRequestTriggerEvent,
    GitHubPushTriggerEvent,
    GitHubTriggerEvent,
    SerializedEvent,
    TriggerEvent,
    WebhookTriggerEvent,
    WorkOSInvitationTriggerEvent,
    WorkOSMembershipTriggerEvent,
    WorkOSOrganizationTriggerEvent,
    WorkOSTriggerEvent,
    WorkOSUserTriggerEvent
} from "terse-types"

/**
 * Lightweight interface for toolbox entries.
 * The backend's concrete ToolboxEntry (which depends on @openai/agents Tool) structurally satisfies this interface.
 */
export interface ToolboxEntry {
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
}

export type SDKTriggerEvent<TEvent extends TriggerEvent = TriggerEvent> = {
    data: TEvent
    formatForAgentRunner(): string
    debugLog(): string
}

// ---------------------------------------------------------------------------
// TypedTrigger – phantom-typed ConfigData for generic event inference
// ---------------------------------------------------------------------------

export type TypedTrigger<TEvent extends TriggerEvent = TriggerEvent> = ConfigData & {
    readonly __eventType?: TEvent
}

export type InferEvent<T> = T extends TypedTrigger<infer E> ? SDKTriggerEvent<E> : SDKTriggerEvent
export type InferEvents<T extends readonly unknown[]> = InferEvent<T[number]>

// ---------------------------------------------------------------------------
// TypedSkill – phantom-typed ConfigData for skill tool inference
// ---------------------------------------------------------------------------

export type TypedSkill<TToolName extends string = never> = ConfigData & {
    readonly __toolApprovalNames?: TToolName
}

export type InferToolApproval<T> = T extends TypedSkill<infer TToolName> ? TToolName : never
export type InferToolApprovals<T extends readonly unknown[]> = InferToolApproval<T[number]>
