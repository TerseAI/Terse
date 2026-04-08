import { IntegrationType, parseTriggerEvent } from "terse-types"
import type {
    ConfigData,
    CronTriggerEvent,
    GithubTriggerEvent,
    GmailTriggerEvent,
    LinearTriggerEvent,
    SlackTriggerEvent,
    TriggerEvent,
    WebhookTriggerEvent,
    WorkOSBaseTriggerEvent,
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

export type GithubInputEvent = GithubTriggerEvent
export type GithubPRInputEvent = GithubTriggerEvent & { pullRequest: NonNullable<GithubTriggerEvent["pullRequest"]> }
export type GithubPushInputEvent = GithubTriggerEvent & { branch: string }
export type WorkOSInputEvent = WorkOSBaseTriggerEvent | WorkOSTriggerEvent
export type WorkOSUserInputEvent = WorkOSUserTriggerEvent
export type WorkOSMembershipInputEvent = WorkOSMembershipTriggerEvent
export type WorkOSInvitationInputEvent = WorkOSInvitationTriggerEvent
export type WorkOSOrganizationInputEvent = WorkOSOrganizationTriggerEvent
export type SlackMessageEvent = SlackTriggerEvent
export type WebhookInputEvent = WebhookTriggerEvent
export type GmailInputEvent = GmailTriggerEvent
export type LinearInputEvent = LinearTriggerEvent
export type CronJobInputEvent = CronTriggerEvent

export function isGithubEvent(event: TriggerEvent): event is GithubInputEvent {
    return event.integrationType === IntegrationType.GITHUB
}

export function isGithubPREvent(event: TriggerEvent): event is GithubPRInputEvent {
    return event.integrationType === IntegrationType.GITHUB && "pullRequest" in event && event.pullRequest !== undefined
}

export function isGithubPushEvent(event: TriggerEvent): event is GithubPushInputEvent {
    return event.integrationType === IntegrationType.GITHUB && event.eventType !== "manual_sample" && "branch" in event && typeof event.branch === "string"
}

export function isWorkOSEvent(event: TriggerEvent): event is WorkOSInputEvent {
    return event.integrationType === IntegrationType.WORKOS
}

export function isWorkOSUserEvent(event: TriggerEvent): event is WorkOSUserInputEvent {
    return event.integrationType === IntegrationType.WORKOS && "user" in event && event.user !== undefined
}

export function isWorkOSMembershipEvent(event: TriggerEvent): event is WorkOSMembershipInputEvent {
    return event.integrationType === IntegrationType.WORKOS && "membership" in event
}

export function isWorkOSInvitationEvent(event: TriggerEvent): event is WorkOSInvitationInputEvent {
    return event.integrationType === IntegrationType.WORKOS && "invitation" in event
}

export function isWorkOSOrganizationEvent(event: TriggerEvent): event is WorkOSOrganizationInputEvent {
    return event.integrationType === IntegrationType.WORKOS && "organization" in event
}

export function isWebhookEvent(event: TriggerEvent): event is WebhookInputEvent {
    return event.integrationType === IntegrationType.WEBHOOK
}

export function deserializeInputEvent(value: unknown): TriggerEvent {
    return parseTriggerEvent(value)
}
