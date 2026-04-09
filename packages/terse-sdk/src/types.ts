import { GitHubEventType, IntegrationType, WorkOSEventType, parseTriggerEvent } from "terse-types"
import type {
    ConfigData,
    GitHubPullRequestTriggerEvent,
    GitHubPushTriggerEvent,
    GitHubTriggerEvent,
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

// ---------------------------------------------------------------------------
// TypedTrigger – phantom-typed ConfigData for generic event inference
// ---------------------------------------------------------------------------

export type TypedTrigger<TEvent extends TriggerEvent = TriggerEvent> = ConfigData & {
    readonly __eventType?: TEvent
}

export type InferEvent<T> = T extends TypedTrigger<infer E> ? E : TriggerEvent
export type InferEvents<T extends readonly unknown[]> = InferEvent<T[number]>

// ---------------------------------------------------------------------------
// TypedSkill – phantom-typed ConfigData for skill tool inference
// ---------------------------------------------------------------------------

export type TypedSkill<TToolName extends string = never> = ConfigData & {
    readonly __toolApprovalNames?: TToolName
}

export type InferToolApproval<T> = T extends TypedSkill<infer TToolName> ? TToolName : never
export type InferToolApprovals<T extends readonly unknown[]> = InferToolApproval<T[number]>

export function isGitHubTriggerEvent(event: TriggerEvent): event is GitHubTriggerEvent {
    return event.integrationType === IntegrationType.GITHUB && event.eventType !== "manual_sample"
}

export function isGitHubPullRequestTriggerEvent(event: TriggerEvent): event is GitHubPullRequestTriggerEvent {
    return event.integrationType === IntegrationType.GITHUB && event.eventType !== GitHubEventType.PUSH
}

export function isGitHubPushTriggerEvent(event: TriggerEvent): event is GitHubPushTriggerEvent {
    return event.integrationType === IntegrationType.GITHUB && event.eventType === GitHubEventType.PUSH
}

export function isWorkOSTriggerEvent(event: TriggerEvent): event is WorkOSTriggerEvent {
    return event.integrationType === IntegrationType.WORKOS && event.eventType !== "manual_sample"
}

export function isWorkOSUserTriggerEvent(event: TriggerEvent): event is WorkOSUserTriggerEvent {
    return (
        event.integrationType === IntegrationType.WORKOS &&
        (event.eventType === WorkOSEventType.USER_CREATED || event.eventType === WorkOSEventType.USER_UPDATED || event.eventType === WorkOSEventType.USER_DELETED)
    )
}

export function isWorkOSMembershipTriggerEvent(event: TriggerEvent): event is WorkOSMembershipTriggerEvent {
    return (
        event.integrationType === IntegrationType.WORKOS &&
        (event.eventType === WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED ||
            event.eventType === WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED ||
            event.eventType === WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED)
    )
}

export function isWorkOSInvitationTriggerEvent(event: TriggerEvent): event is WorkOSInvitationTriggerEvent {
    return (
        event.integrationType === IntegrationType.WORKOS &&
        (event.eventType === WorkOSEventType.INVITATION_CREATED ||
            event.eventType === WorkOSEventType.INVITATION_ACCEPTED ||
            event.eventType === WorkOSEventType.INVITATION_RESENT ||
            event.eventType === WorkOSEventType.INVITATION_REVOKED)
    )
}

export function isWorkOSOrganizationTriggerEvent(event: TriggerEvent): event is WorkOSOrganizationTriggerEvent {
    return event.integrationType === IntegrationType.WORKOS && event.eventType === WorkOSEventType.ORGANIZATION_CREATED
}

export function isWebhookTriggerEvent(event: TriggerEvent): event is WebhookTriggerEvent {
    return event.integrationType === IntegrationType.WEBHOOK && event.eventType !== "manual_sample"
}

export function deserializeTriggerEvent(value: unknown): TriggerEvent {
    return parseTriggerEvent(value)
}
