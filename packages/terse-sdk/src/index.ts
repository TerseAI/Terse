import ms from "ms"
import type {
    RunHistoryAction,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    SdkApprovalDecisionRequestBody,
    SdkInputRequestDelivery,
    SdkInputRequestOption,
    SdkInputRequestRegisterBody,
    SdkInputRequestTarget,
    SdkInputResponsePayload,
    SdkStateGetRequest,
    SdkStatePutRequest,
    WebhookJobChallengeResponse,
    WebhookJobTriggerResponse
} from "terse-types"
import {
    ApiRoutes,
    IntegrationType,
    sdkAgentRunRequestBodySchema,
    sdkInputRequestRegisterResponseSchema,
    sdkStateGetResponseSchema,
    stripZodJsonSchemaMetadata,
    webhookJobChallengeRequestSchema,
    webhookJobTriggerRequestSchema
} from "terse-types"
// Re-export trigger event types enriched with SDK methods (formatForAgentRunner/debugLog)
// so users get the correct type when annotating onTrigger/filter callback parameters.
import type {
    AttioCallRecordingCreatedTrigger as _RawAttioCallRecordingCreatedTrigger,
    AttioCommentCreatedTrigger as _RawAttioCommentCreatedTrigger,
    AttioCommentDeletedTrigger as _RawAttioCommentDeletedTrigger,
    AttioCommentResolvedTrigger as _RawAttioCommentResolvedTrigger,
    AttioCommentUnresolvedTrigger as _RawAttioCommentUnresolvedTrigger,
    AttioListAttributeCreatedTrigger as _RawAttioListAttributeCreatedTrigger,
    AttioListAttributeUpdatedTrigger as _RawAttioListAttributeUpdatedTrigger,
    AttioListCreatedTrigger as _RawAttioListCreatedTrigger,
    AttioListDeletedTrigger as _RawAttioListDeletedTrigger,
    AttioListEntryCreatedTrigger as _RawAttioListEntryCreatedTrigger,
    AttioListEntryDeletedTrigger as _RawAttioListEntryDeletedTrigger,
    AttioListEntryUpdatedTrigger as _RawAttioListEntryUpdatedTrigger,
    AttioListUpdatedTrigger as _RawAttioListUpdatedTrigger,
    AttioNoteContentUpdatedTrigger as _RawAttioNoteContentUpdatedTrigger,
    AttioNoteCreatedTrigger as _RawAttioNoteCreatedTrigger,
    AttioNoteDeletedTrigger as _RawAttioNoteDeletedTrigger,
    AttioNoteUpdatedTrigger as _RawAttioNoteUpdatedTrigger,
    AttioObjectAttributeCreatedTrigger as _RawAttioObjectAttributeCreatedTrigger,
    AttioObjectAttributeUpdatedTrigger as _RawAttioObjectAttributeUpdatedTrigger,
    AttioRecordCreatedTrigger as _RawAttioRecordCreatedTrigger,
    AttioRecordDeletedTrigger as _RawAttioRecordDeletedTrigger,
    AttioRecordMergedTrigger as _RawAttioRecordMergedTrigger,
    AttioRecordUpdatedTrigger as _RawAttioRecordUpdatedTrigger,
    AttioTaskCreatedTrigger as _RawAttioTaskCreatedTrigger,
    AttioTaskDeletedTrigger as _RawAttioTaskDeletedTrigger,
    AttioTaskUpdatedTrigger as _RawAttioTaskUpdatedTrigger,
    AttioTrigger as _RawAttioTrigger,
    AttioWorkspaceMemberCreatedTrigger as _RawAttioWorkspaceMemberCreatedTrigger,
    CronTrigger as _RawCronTrigger,
    GithubIssueCommentCreatedTrigger as _RawGithubIssueCommentCreatedTrigger,
    GithubPRClosedTrigger as _RawGithubPRClosedTrigger,
    GithubPRMergedTrigger as _RawGithubPRMergedTrigger,
    GithubPROpenedTrigger as _RawGithubPROpenedTrigger,
    GithubPRSynchronizedTrigger as _RawGithubPRSynchronizedTrigger,
    GithubPRTrigger as _RawGithubPRTrigger,
    GithubPushTrigger as _RawGithubPushTrigger,
    GithubTrigger as _RawGithubTrigger,
    GmailTrigger as _RawGmailTrigger,
    HeyReachCampaignCompletedTrigger as _RawHeyReachCampaignCompletedTrigger,
    HeyReachConnectionRequestAcceptedTrigger as _RawHeyReachConnectionRequestAcceptedTrigger,
    HeyReachConnectionRequestSentTrigger as _RawHeyReachConnectionRequestSentTrigger,
    HeyReachFollowSentTrigger as _RawHeyReachFollowSentTrigger,
    HeyReachInmailReplyReceivedTrigger as _RawHeyReachInmailReplyReceivedTrigger,
    HeyReachInmailSentTrigger as _RawHeyReachInmailSentTrigger,
    HeyReachLeadTagUpdatedTrigger as _RawHeyReachLeadTagUpdatedTrigger,
    HeyReachLikedPostTrigger as _RawHeyReachLikedPostTrigger,
    HeyReachMessageReplyReceivedTrigger as _RawHeyReachMessageReplyReceivedTrigger,
    HeyReachMessageSentTrigger as _RawHeyReachMessageSentTrigger,
    HeyReachTrigger as _RawHeyReachTrigger,
    HeyReachViewedProfileTrigger as _RawHeyReachViewedProfileTrigger,
    LinearCommentCreatedTrigger as _RawLinearCommentCreatedTrigger,
    LinearIssueCreatedTrigger as _RawLinearIssueCreatedTrigger,
    LinearIssueUpdatedTrigger as _RawLinearIssueUpdatedTrigger,
    LinearTrigger as _RawLinearTrigger,
    ManualSampleTrigger as _RawManualSampleTrigger,
    SlackAppMentionTrigger as _RawSlackAppMentionTrigger,
    SlackMessageTrigger as _RawSlackMessageTrigger,
    SlackReactionAddedTrigger as _RawSlackReactionAddedTrigger,
    SlackTrigger as _RawSlackTrigger,
    Trigger as _RawTrigger,
    WebMonitorTrigger as _RawWebMonitorTrigger,
    WebhookTrigger as _RawWebhookTrigger,
    WorkOSInvitationAcceptedTrigger as _RawWorkOSInvitationAcceptedTrigger,
    WorkOSInvitationCreatedTrigger as _RawWorkOSInvitationCreatedTrigger,
    WorkOSInvitationResentTrigger as _RawWorkOSInvitationResentTrigger,
    WorkOSInvitationRevokedTrigger as _RawWorkOSInvitationRevokedTrigger,
    WorkOSInvitationTrigger as _RawWorkOSInvitationTrigger,
    WorkOSMembershipTrigger as _RawWorkOSMembershipTrigger,
    WorkOSOrganizationMembershipCreatedTrigger as _RawWorkOSOrganizationMembershipCreatedTrigger,
    WorkOSOrganizationMembershipDeletedTrigger as _RawWorkOSOrganizationMembershipDeletedTrigger,
    WorkOSOrganizationMembershipUpdatedTrigger as _RawWorkOSOrganizationMembershipUpdatedTrigger,
    WorkOSOrganizationTrigger as _RawWorkOSOrganizationTrigger,
    WorkOSTrigger as _RawWorkOSTrigger,
    WorkOSUserCreatedTrigger as _RawWorkOSUserCreatedTrigger,
    WorkOSUserDeletedTrigger as _RawWorkOSUserDeletedTrigger,
    WorkOSUserTrigger as _RawWorkOSUserTrigger,
    WorkOSUserUpdatedTrigger as _RawWorkOSUserUpdatedTrigger
} from "terse-types"
import { createHook, fetch as workflowFetch, sleep as workflowSleep } from "workflow"
import { z } from "zod"

import { claimAgentApprovalHandling, releaseAgentApprovalHandling } from "./context.js"
import { computeChallengeSignature, verifyIncomingRequest } from "./hmac.js"
import { resolveRunIdentity } from "./runIdentity/index.js"
import { openSessionStream } from "./sessionStream.js"
import {
    type InferEvents,
    InferStructuredOutput,
    type InferToolApprovals,
    type SDKTrigger,
    type StateAccessor,
    type StateDefinition,
    type TypedSkill,
    type TypedTrigger,
    createSDKTrigger
} from "./types.js"

declare const process: { env: Record<string, string | undefined> }

function resolveTerseBackendUrl(): string {
    return process.env.TERSE_BACKEND_URL || "https://api.useterse.ai"
}

function resolveApiBaseUrl(): string {
    return resolveTerseBackendUrl()
}

async function buildSdkRequestHeaders(): Promise<Record<string, string>> {
    const apiKey = process.env.TERSE_API_KEY
    if (!apiKey) {
        throw new Error("TERSE_API_KEY environment variable is not set.")
    }
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
    }
    const { sessionId, runId, projectId, jobName } = await resolveRunIdentity()
    if (sessionId) headers["X-Terse-Session-Id"] = sessionId
    if (runId) headers["X-Terse-Run-Id"] = runId
    if (projectId) headers["X-Terse-Project-Id"] = projectId
    if (jobName) headers["X-Terse-Job-Name"] = jobName
    return headers
}

export const TERSE_JOB_WEBHOOK_TRIGGER_PATH = ApiRoutes.SDK.JOB_WEBHOOK_TRIGGER

export { isAgentApprovalHandlingClaimed } from "./context.js"
export type { TerseJobContext } from "./context.js"

export { SessionStreamError, openListenStream, openSessionStream } from "./sessionStream.js"
export type { ListenStreamHandle, OpenListenStreamOptions, OpenSessionStreamOptions, SessionStartedEvent, SessionStreamEvent, SessionStreamHandle } from "./sessionStream.js"

// Re-export SDK-specific types
export { createSDKTrigger, registerEventTransform } from "./types.js"
export type {
    InferEvent,
    InferEvents,
    InferStructuredOutput,
    InferToolApproval,
    InferToolApprovals,
    SDKTrigger,
    StateAccessor,
    StateDefinition,
    ToolboxEntry,
    TypedSkill,
    TypedTrigger
} from "./types.js"

// Re-export shared types for consumer convenience
export {
    AttioEventType,
    AttioInputConfig,
    AttioOutputConfig,
    ConfigInstance,
    ConfigType,
    DatadogConfig,
    GitHubConfig,
    GitHubEventType,
    GmailConfig,
    GmailDraftOutputConfig,
    GmailEventType,
    GmailOutputConfig,
    HeyReachEventType,
    HeyReachInputConfig,
    ImageEditConfig,
    LaunchDarklyConfig,
    LinearEventType,
    LinearInputConfig,
    LinearOutputConfig,
    MemoryConfig,
    NotionConfig,
    PosthogConfig,
    SlackConfig,
    SlackEventType,
    SlackOutputConfig,
    SnowflakeOutputConfig,
    TimeTriggerConfig,
    WebConfig,
    WebMonitorConfig,
    WebhookInputConfig,
    WorkOSEventType,
    WorkOSInputConfig,
    WorkOSOutputConfig,
    debugTrigger,
    formatTriggerForAgent
} from "terse-types"

export type Trigger = SDKTrigger<_RawTrigger>
export type AttioCallRecordingCreatedTrigger = SDKTrigger<_RawAttioCallRecordingCreatedTrigger>
export type AttioCommentCreatedTrigger = SDKTrigger<_RawAttioCommentCreatedTrigger>
export type AttioCommentResolvedTrigger = SDKTrigger<_RawAttioCommentResolvedTrigger>
export type AttioCommentUnresolvedTrigger = SDKTrigger<_RawAttioCommentUnresolvedTrigger>
export type AttioCommentDeletedTrigger = SDKTrigger<_RawAttioCommentDeletedTrigger>
export type AttioListCreatedTrigger = SDKTrigger<_RawAttioListCreatedTrigger>
export type AttioListUpdatedTrigger = SDKTrigger<_RawAttioListUpdatedTrigger>
export type AttioListDeletedTrigger = SDKTrigger<_RawAttioListDeletedTrigger>
export type AttioListAttributeCreatedTrigger = SDKTrigger<_RawAttioListAttributeCreatedTrigger>
export type AttioListAttributeUpdatedTrigger = SDKTrigger<_RawAttioListAttributeUpdatedTrigger>
export type AttioListEntryCreatedTrigger = SDKTrigger<_RawAttioListEntryCreatedTrigger>
export type AttioListEntryUpdatedTrigger = SDKTrigger<_RawAttioListEntryUpdatedTrigger>
export type AttioListEntryDeletedTrigger = SDKTrigger<_RawAttioListEntryDeletedTrigger>
export type AttioObjectAttributeCreatedTrigger = SDKTrigger<_RawAttioObjectAttributeCreatedTrigger>
export type AttioObjectAttributeUpdatedTrigger = SDKTrigger<_RawAttioObjectAttributeUpdatedTrigger>
export type AttioNoteCreatedTrigger = SDKTrigger<_RawAttioNoteCreatedTrigger>
export type AttioNoteContentUpdatedTrigger = SDKTrigger<_RawAttioNoteContentUpdatedTrigger>
export type AttioNoteUpdatedTrigger = SDKTrigger<_RawAttioNoteUpdatedTrigger>
export type AttioNoteDeletedTrigger = SDKTrigger<_RawAttioNoteDeletedTrigger>
type _AttioRecordPayload<TValues> = Omit<_RawAttioRecordCreatedTrigger["record"], "values"> & { values: TValues }
export type AttioRecordCreatedTrigger<TValues = Record<string, unknown>> = Omit<SDKTrigger<_RawAttioRecordCreatedTrigger>, "record"> & { record: _AttioRecordPayload<TValues> }
export type AttioRecordMergedTrigger<TValues = Record<string, unknown>> = Omit<SDKTrigger<_RawAttioRecordMergedTrigger>, "record"> & { record: _AttioRecordPayload<TValues> }
export type AttioRecordUpdatedTrigger<TValues = Record<string, unknown>> = Omit<SDKTrigger<_RawAttioRecordUpdatedTrigger>, "record"> & { record: _AttioRecordPayload<TValues> }
export type AttioRecordDeletedTrigger = SDKTrigger<_RawAttioRecordDeletedTrigger>
export type AttioTaskCreatedTrigger = SDKTrigger<_RawAttioTaskCreatedTrigger>
export type AttioTaskUpdatedTrigger = SDKTrigger<_RawAttioTaskUpdatedTrigger>
export type AttioTaskDeletedTrigger = SDKTrigger<_RawAttioTaskDeletedTrigger>
export type AttioWorkspaceMemberCreatedTrigger = SDKTrigger<_RawAttioWorkspaceMemberCreatedTrigger>
export type AttioTrigger = SDKTrigger<_RawAttioTrigger>
export type CronTrigger = SDKTrigger<_RawCronTrigger>
export type GithubPRClosedTrigger = SDKTrigger<_RawGithubPRClosedTrigger>
export type GithubPROpenedTrigger = SDKTrigger<_RawGithubPROpenedTrigger>
export type GithubPRMergedTrigger = SDKTrigger<_RawGithubPRMergedTrigger>
export type GithubPRSynchronizedTrigger = SDKTrigger<_RawGithubPRSynchronizedTrigger>
export type GithubIssueCommentCreatedTrigger = SDKTrigger<_RawGithubIssueCommentCreatedTrigger>
export type GithubPRTrigger = SDKTrigger<_RawGithubPRTrigger>
export type GithubPushTrigger = SDKTrigger<_RawGithubPushTrigger>
export type GithubTrigger = SDKTrigger<_RawGithubTrigger>
export type GmailTrigger = SDKTrigger<_RawGmailTrigger>
export type HeyReachConnectionRequestSentTrigger = SDKTrigger<_RawHeyReachConnectionRequestSentTrigger>
export type HeyReachConnectionRequestAcceptedTrigger = SDKTrigger<_RawHeyReachConnectionRequestAcceptedTrigger>
export type HeyReachMessageSentTrigger = SDKTrigger<_RawHeyReachMessageSentTrigger>
export type HeyReachMessageReplyReceivedTrigger = SDKTrigger<_RawHeyReachMessageReplyReceivedTrigger>
export type HeyReachInmailSentTrigger = SDKTrigger<_RawHeyReachInmailSentTrigger>
export type HeyReachInmailReplyReceivedTrigger = SDKTrigger<_RawHeyReachInmailReplyReceivedTrigger>
export type HeyReachFollowSentTrigger = SDKTrigger<_RawHeyReachFollowSentTrigger>
export type HeyReachLikedPostTrigger = SDKTrigger<_RawHeyReachLikedPostTrigger>
export type HeyReachViewedProfileTrigger = SDKTrigger<_RawHeyReachViewedProfileTrigger>
export type HeyReachCampaignCompletedTrigger = SDKTrigger<_RawHeyReachCampaignCompletedTrigger>
export type HeyReachLeadTagUpdatedTrigger = SDKTrigger<_RawHeyReachLeadTagUpdatedTrigger>
export type HeyReachTrigger = SDKTrigger<_RawHeyReachTrigger>
export type LinearCommentCreatedTrigger = SDKTrigger<_RawLinearCommentCreatedTrigger>
export type LinearIssueCreatedTrigger = SDKTrigger<_RawLinearIssueCreatedTrigger>
export type LinearIssueUpdatedTrigger = SDKTrigger<_RawLinearIssueUpdatedTrigger>
export type LinearTrigger = SDKTrigger<_RawLinearTrigger>
export type ManualSampleTrigger = SDKTrigger<_RawManualSampleTrigger>
export type SlackAppMentionTrigger = SDKTrigger<_RawSlackAppMentionTrigger>
export type SlackMessageTrigger = SDKTrigger<_RawSlackMessageTrigger>
export type SlackReactionAddedTrigger = SDKTrigger<_RawSlackReactionAddedTrigger>
export type SlackTrigger = SDKTrigger<_RawSlackTrigger>
export type WebhookTrigger<TBody = unknown> = SDKTrigger<_RawWebhookTrigger<TBody>>
export type WebMonitorTrigger<TStructured = unknown> = SDKTrigger<_RawWebMonitorTrigger<TStructured>>
export type WebMonitorTriggerFor<TSchema> = WebMonitorTrigger<InferStructuredOutput<TSchema>>
export type WorkOSInvitationAcceptedTrigger = SDKTrigger<_RawWorkOSInvitationAcceptedTrigger>
export type WorkOSInvitationCreatedTrigger = SDKTrigger<_RawWorkOSInvitationCreatedTrigger>
export type WorkOSInvitationTrigger = SDKTrigger<_RawWorkOSInvitationTrigger>
export type WorkOSInvitationResentTrigger = SDKTrigger<_RawWorkOSInvitationResentTrigger>
export type WorkOSInvitationRevokedTrigger = SDKTrigger<_RawWorkOSInvitationRevokedTrigger>
export type WorkOSOrganizationMembershipCreatedTrigger = SDKTrigger<_RawWorkOSOrganizationMembershipCreatedTrigger>
export type WorkOSOrganizationMembershipDeletedTrigger = SDKTrigger<_RawWorkOSOrganizationMembershipDeletedTrigger>
export type WorkOSOrganizationMembershipUpdatedTrigger = SDKTrigger<_RawWorkOSOrganizationMembershipUpdatedTrigger>
export type WorkOSMembershipTrigger = SDKTrigger<_RawWorkOSMembershipTrigger>
export type WorkOSOrganizationTrigger = SDKTrigger<_RawWorkOSOrganizationTrigger>
export type WorkOSTrigger = SDKTrigger<_RawWorkOSTrigger>
export type WorkOSUserCreatedTrigger = SDKTrigger<_RawWorkOSUserCreatedTrigger>
export type WorkOSUserDeletedTrigger = SDKTrigger<_RawWorkOSUserDeletedTrigger>
export type WorkOSUserUpdatedTrigger = SDKTrigger<_RawWorkOSUserUpdatedTrigger>
export type WorkOSUserTrigger = SDKTrigger<_RawWorkOSUserTrigger>

export { FrequencyUnit, IntegrationType } from "terse-types"
export type { SdkAgentRunOptionsPayload, SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentStreamEvent, ToolInputByName, ToolOutputByName } from "terse-types"

export { RunHistoryAction, RunHistoryDecision, RunHistoryRecord, RunHistoryStatus, RunHistoryTrigger } from "terse-types"

// SDK types

type Action = RunHistoryAction

export type CreateJobParameters<TTriggers extends readonly TypedTrigger[] = TypedTrigger[], TStates extends readonly StateDefinition[] = readonly StateDefinition[]> = {
    name: string
    triggers: [...TTriggers]
    states?: [...TStates]
    filter?: (event: InferEvents<TTriggers>, state: StateAccessor<TStates>) => boolean | Promise<boolean>
    onTrigger: (event: InferEvents<TTriggers>, state: StateAccessor<TStates>) => Promise<void>
    remoteServerUrl?: string
    durable?: boolean
}

export function createJob<TTriggers extends readonly TypedTrigger[], const TStates extends readonly StateDefinition[] = readonly []>(params: CreateJobParameters<TTriggers, TStates>) {
    const currentJobs = fetchRegisteredJobs()
    if (currentJobs.has(params.name)) {
        throw new Error(`Job "${params.name}" is registered twice on this Terse instance.`)
    }
    const webhookCount = params.triggers.filter(t => t.integrationType === IntegrationType.WEBHOOK).length
    if (webhookCount > 1) {
        throw new Error(`Job "${params.name}" has ${webhookCount} webhook triggers. Only one webhook trigger per job is allowed.`)
    }
    registerJob<TTriggers>(params)
}

// Process-wide directory of Terse instances. Each `new Terse()` registers itself here on
// construction so the CLI (via tsImport) can discover jobs across module-graph boundaries.
// Keyed by a process-global Symbol so every copy of this module shares one array.
// type JobsLike = { jobs: Map<string, CreateJobParameters> }
const TERSE_INSTANCES_KEY = Symbol.for("jobs.instances")
type GlobalWithInstances = typeof globalThis & { [TERSE_INSTANCES_KEY]?: Map<string, CreateJobParameters> }

function registerJob<TTriggers extends readonly TypedTrigger[]>(job: CreateJobParameters<TTriggers>): void {
    const g = globalThis as GlobalWithInstances
    g[TERSE_INSTANCES_KEY] ??= new Map<string, CreateJobParameters>()

    if (g[TERSE_INSTANCES_KEY].has(job.name)) {
        throw new Error(`Job "${job.name}" is registered twice on this Terse instance.`)
    }

    g[TERSE_INSTANCES_KEY].set(job.name, job as unknown as CreateJobParameters)
}

export function fetchRegisteredJobs(): Map<string, CreateJobParameters> {
    const g = globalThis as GlobalWithInstances
    return g[TERSE_INSTANCES_KEY] ?? new Map<string, CreateJobParameters>()
}

// Clear the process-global instance registry. The CLI calls this before
// re-importing an entry file so a second import (e.g. after a retry) starts
// from a clean slate instead of seeing stale instances from the first pass.
export function __resetRegisteredTerseInstances(): void {
    const g = globalThis as GlobalWithInstances
    g[TERSE_INSTANCES_KEY] = new Map<string, CreateJobParameters>()
}

async function stateGet(key: string): Promise<string | null> {
    "use step"
    const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.STATE_GET}`, {
        method: "POST",
        headers: await buildSdkRequestHeaders(),
        body: JSON.stringify({ key } satisfies SdkStateGetRequest)
    })
    if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`Failed to read state "${key}": ${data.error ?? res.statusText}`)
    }
    return sdkStateGetResponseSchema.parse(await res.json()).content
}

async function statePut(key: string, content: string): Promise<void> {
    "use step"
    const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.STATE_PUT}`, {
        method: "POST",
        headers: await buildSdkRequestHeaders(),
        body: JSON.stringify({ key, content } satisfies SdkStatePutRequest)
    })
    if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`Failed to write state "${key}": ${data.error ?? res.statusText}`)
    }
}

export function __buildJobStateAccessor<TStates extends readonly StateDefinition[]>(states: TStates): StateAccessor<TStates> {
    const schemas = new Map(states.map(s => [s.key, s.value] as const))
    const schemaFor = (key: string): z.ZodType => {
        const schema = schemas.get(key)
        if (!schema) throw new Error(`Unknown state key "${key}". Declare it in the job's \`states\`.`)
        return schema
    }
    const accessor: StateAccessorImpl = {
        async get(key) {
            const schema = schemaFor(key)
            const raw = await stateGet(key)
            if (raw !== null) return schema.parse(JSON.parse(raw))
            return schema.safeParse(undefined).data
        },
        async set(key, value) {
            const schema = schemaFor(key)
            const parsed = schema.safeParse(value)
            if (!parsed.success) {
                throw new Error(`Invalid value for state "${key}": ${parsed.error.issues.map(issue => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")}`)
            }
            await statePut(key, JSON.stringify(parsed.data))
            return parsed.data
        }
    }
    // TS can't correlate a dynamic string key to its schema's type (microsoft/TypeScript#30581), so we assert the per-key shape here.
    return accessor as StateAccessor<TStates>
}

export class Terse {
    constructor() {}
    /**
     * Handle an incoming trigger request from the Terse backend.
     * Wire this into your own HTTP route (Express, Hono, Next.js, etc.).
     *
     * Two-phase protocol: (1) POST with `{ type: "challenge", challenge: "<token>" }` verifies the
     * HMAC signature and echoes the challenge with a signed response. (2) POST with
     * `{ jobName, runId, event }` opens an SDK session stream, **awaits** `onTrigger` (so this
     * method does not return until your job handler finishes), then closes the session stream.
     *
     * Both phases require `TERSE_SIGNING_SECRET` to verify request signatures.
     *
     * @example
     * ```ts
     * // Express — use TERSE_JOB_WEBHOOK_TRIGGER_PATH so the path matches the backend.
     * app.post(TERSE_JOB_WEBHOOK_TRIGGER_PATH, async (req, res) => {
     *     const result = await terse.handleTrigger(req.body, req.headers)
     *     res.json(result)
     * })
     * ```
     */
    async handleTrigger(body: unknown, headers: Record<string, string | string[] | undefined>): Promise<WebhookJobChallengeResponse | WebhookJobTriggerResponse> {
        const signingSecret = process.env.TERSE_SIGNING_SECRET
        if (!signingSecret) {
            throw new Error(
                "TERSE_SIGNING_SECRET is not set. " +
                    "Add it to your .env file or export it before starting your server. " +
                    "You can find your signing secret in the Terse dashboard under your job's settings."
            )
        }

        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY is not set. " + "Add it to your .env file or export it before starting your server.")
        }

        await verifyIncomingRequest(signingSecret, headers, JSON.stringify(body))

        const challenge = webhookJobChallengeRequestSchema.safeParse(body)
        if (challenge.success) {
            const signature = await computeChallengeSignature(signingSecret, challenge.data.challenge)
            return { challenge: challenge.data.challenge, signature }
        }

        const full = webhookJobTriggerRequestSchema.safeParse(body)
        if (!full.success) {
            const detail = full.error.issues.map((issue: { message: string }) => issue.message).join("; ")
            throw new Error(`Invalid trigger payload: ${detail}`)
        }

        const jobs = fetchRegisteredJobs()

        const { jobName, runId, event } = full.data
        const job = jobs.get(jobName)
        if (!job) {
            const available = [...jobs.keys()]
            throw new Error(
                `Job "${jobName}" is not registered on this Terse instance. ` +
                    (available.length
                        ? `Registered jobs: ${available.join(", ")}. Make sure the job name in your Terse dashboard matches your code.`
                        : `No jobs are registered. Make sure your job file is imported before the server starts.`)
            )
        }

        const apiBaseUrl = resolveTerseBackendUrl()
        const session = await openSessionStream(apiBaseUrl, apiKey)

        try {
            const inputEvent = createSDKTrigger(event)
            const state = __buildJobStateAccessor(job.states ?? [])

            if (job.filter) {
                const shouldRun = await job.filter(inputEvent, state)
                if (!shouldRun) {
                    return { status: "ok" as const, filtered: true }
                }
            }
            await job.onTrigger(inputEvent, state)

            return { status: "ok" as const }
        } catch (error) {
            session.close()
            throw error
        } finally {
            session.close()
        }
    }
}

export type ApprovalRequestInfo = {
    stepId: string
    toolName: string
    arguments: string
}

export class TerseAgent<TSkills extends readonly TypedSkill<string>[] = readonly TypedSkill<string>[]> {
    readonly prompt: string
    readonly skills: TSkills
    readonly toolApprovals: InferToolApprovals<TSkills>[]

    /**
     * Optional callback invoked when the agent requires tool approval.
     * Return `true` to approve, `false` to reject.
     * If not set, approval events are yielded as ToolApprovalRequestedResult
     * but no decision is submitted (the stream will hang waiting).
     */
    onApprovalRequired?: (info: ApprovalRequestInfo) => Promise<boolean>

    private constructor(params: { prompt: string; skills: TSkills; toolApprovals: InferToolApprovals<TSkills>[] }) {
        this.prompt = params.prompt
        this.skills = params.skills
        this.toolApprovals = params.toolApprovals

        const createTools = (globalThis as any).__terse_createTools as ((agent: TerseAgent) => unknown) | undefined
        ;(this as any).tools = createTools ? createTools(this) : {}
    }

    static create<TSkills extends readonly TypedSkill<string>[]>(params: { prompt: string; skills: [...TSkills]; toolApprovals?: InferToolApprovals<TSkills>[] }): TerseAgent<TSkills>
    static create(params: { prompt: string }): TerseAgent<readonly []>
    static create<TSkills extends readonly TypedSkill<string>[] = readonly []>(params: { prompt: string; skills?: [...TSkills]; toolApprovals?: InferToolApprovals<TSkills>[] }): TerseAgent<TSkills> {
        const skills = (params.skills ?? []) as TSkills
        const toolApprovals = (params.toolApprovals ?? []) as InferToolApprovals<TSkills>[]
        return new TerseAgent<TSkills>({ prompt: params.prompt, skills, toolApprovals })
    }

    async *run(userMessage: string, outputSchema?: z.ZodType): AsyncGenerator<TerseAgentResult> {
        const requestBody = this.buildRequestBody(userMessage, outputSchema)

        // Claim approval handling for this run if the caller wired up its own
        // callback, so the CLI's session-stream handler won't also prompt and
        // submit a decision for the same stepId.
        const ownsApprovals = !!this.onApprovalRequired
        if (ownsApprovals) claimAgentApprovalHandling()

        try {
            const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.AGENT_RUN}`, {
                method: "POST",
                headers: await buildSdkRequestHeaders(),
                body: JSON.stringify(requestBody)
            })

            const contentType = res.headers.get("content-type") ?? ""
            if (contentType.includes("text/event-stream")) {
                yield* this.consumeSseStream(res)
                return
            }

            const data = (await res.json()) as SdkAgentRunResponseBody
            if (!res.ok || !data.success) {
                const details = data.details?.length ? ` (${data.details.join("; ")})` : ""
                throw new Error(`${data.error ?? "Agent run failed"}${details}`)
            }

            yield new TextResult("Agent run request accepted.")
        } finally {
            if (ownsApprovals) releaseAgentApprovalHandling()
        }
    }

    async submitApprovalDecision(params: { runId: string; stepId: string; approved: boolean }): Promise<void> {
        "use step"
        const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.APPROVAL_DECISION}`, {
            method: "POST",
            headers: await buildSdkRequestHeaders(),
            body: JSON.stringify(params satisfies SdkApprovalDecisionRequestBody)
        })

        if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
            throw new Error(`Approval decision failed: ${data.error ?? res.statusText}`)
        }
    }

    async runAndWait<OutputSchema extends z.ZodType>(userMessage: string, outputSchema: OutputSchema): Promise<z.infer<OutputSchema>>
    async runAndWait(userMessage: string): Promise<string>
    async runAndWait<OutputSchema extends z.ZodType>(userMessage: string, outputSchema?: OutputSchema): Promise<string | z.infer<OutputSchema>> {
        const requestBody = this.buildRequestBody(userMessage, outputSchema)
        const raw = await TerseAgent.fetchFinalOutput(requestBody)
        if (!outputSchema) return raw
        return outputSchema.parse(JSON.parse(raw))
    }

    private buildRequestBody(userMessage: string, outputSchema?: z.ZodType): SdkAgentRunRequestBody {
        return sdkAgentRunRequestBodySchema.parse({
            prompt: this.prompt,
            toolApprovals: this.toolApprovals,
            message: userMessage,
            skills: this.skills,
            outputSchema: outputSchema ? stripZodJsonSchemaMetadata(z.toJSONSchema(outputSchema)) : undefined
        })
    }

    private static async fetchFinalOutput(requestBody: SdkAgentRunRequestBody): Promise<string> {
        "use step"
        const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.AGENT_RUN}`, {
            method: "POST",
            headers: await TerseAgent.buildHeaders(),
            body: JSON.stringify(requestBody)
        })
        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("text/event-stream")) {
            const data: SdkAgentRunResponseBody = await res.json()
            const details = data.details?.length ? ` (${data.details.join("; ")})` : ""
            if (!res.ok || !data.success) throw new Error(`${data.error ?? "Agent run failed"}${details}`)
            throw new Error("Run completed without final output")
        }
        if (!res.body) throw new Error("Stream did not provide a response body.")
        for await (const eventData of iterateSseDataLines(res.body)) {
            const parsed = safeParseStreamEvent(eventData)
            if (!parsed) continue
            if (parsed.type === "error") throw new Error(parsed.message)
            if (parsed.type === "done") break
            const result = mapStreamEventToResult(parsed)
            if (result instanceof FinalOutputResult) return result.finalOutput
        }
        throw new Error("Run completed without final output")
    }

    static async executeTool<TOutput = unknown>(toolName: string, params: Record<string, unknown> = {}): Promise<TOutput> {
        "use step"
        const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.TOOL_EXECUTE}`, {
            method: "POST",
            headers: await buildSdkRequestHeaders(),
            body: JSON.stringify({ toolName, params })
        })
        const data = (await res.json()) as { success: boolean; result?: unknown; error?: string }
        if (!data.success) {
            throw new Error(data.error ?? "Tool execution failed")
        }
        return data.result as TOutput
    }

    private static async buildHeaders(): Promise<Record<string, string>> {
        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY environment variable is not set.")
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream"
        }
        const { sessionId, runId } = await resolveRunIdentity()
        if (sessionId) headers["X-Terse-Session-Id"] = sessionId
        const runIdHeader = runId ?? process.env.TERSE_RUN_ID
        if (runIdHeader) headers["X-Terse-Run-Id"] = runIdHeader
        return headers
    }

    private async *consumeSseStream(res: Response): AsyncGenerator<TerseAgentResult> {
        if (!res.body) {
            throw new Error("Stream did not provide a response body.")
        }
        let runId = ""
        const failedToolCalls: string[] = []
        for await (const eventData of iterateSseDataLines(res.body)) {
            const parsed = safeParseStreamEvent(eventData)
            if (!parsed) continue
            if (parsed.type === "run_started") {
                runId = parsed.runId
                continue
            }
            if (parsed.type === "done") {
                if (failedToolCalls.length > 0) {
                    throw new Error(`Run completed with failed tool calls: ${failedToolCalls.join("; ")}`)
                }
                return
            }
            if (parsed.type === "error") {
                throw new Error(parsed.message)
            }
            if (parsed.type === "tool_call_completed") {
                const parsedTool = parseToolCallCompleted(parsed.toolCallCompleted)
                if (parsedTool && parsedTool.status && parsedTool.status !== "completed") {
                    failedToolCalls.push(`${parsedTool.tool}: ${parsedTool.status}`)
                }
            }
            if (parsed.type === "tool_approval_requested" && this.onApprovalRequired) {
                const info = parsed.toolApprovalRequested
                yield mapStreamEventToResult(parsed)
                const approved = await this.onApprovalRequired(info)
                await this.submitApprovalDecision({ runId, stepId: info.stepId, approved })
                continue
            }
            yield mapStreamEventToResult(parsed)
        }
    }
}

type GenerateTextParams<TSkills extends readonly TypedSkill<string>[] = readonly TypedSkill<string>[]> = {
    prompt: string
    skills?: TSkills
    toolApprovals?: InferToolApprovals<TSkills>[]
}

type GenerateTextStructuredOutput<OutputSchema extends z.ZodType> = GenerateTextParams & {
    outputSchema: OutputSchema
}

export async function generateText<OutputSchema extends z.ZodType>(params: GenerateTextStructuredOutput<OutputSchema>): Promise<z.infer<OutputSchema>>
export async function generateText(params: GenerateTextParams): Promise<string>
export async function generateText<OutputSchema extends z.ZodType>(params: GenerateTextParams | GenerateTextStructuredOutput<OutputSchema>): Promise<string | z.infer<OutputSchema>> {
    const agent = TerseAgent.create({
        prompt: " ",
        skills: params.skills ? [...params.skills] : [],
        toolApprovals: params.toolApprovals
    })
    if ("outputSchema" in params) {
        return await agent.runAndWait(params.prompt, params.outputSchema)
    }
    return await agent.runAndWait(params.prompt)
}

export class DurableOnlyError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "DurableOnlyError"
    }
}

// The durable runtime injects its sleep implementation on globalThis; its presence is
// how we detect that we're running inside a durable job.
function isDurableExecution(): boolean {
    return Boolean(Reflect.get(globalThis, Symbol.for("WORKFLOW_SLEEP")))
}

export function jobStep<I extends z.ZodType, O>(opts: { input: z.infer<I>; inputSchema: I; outputSchema?: z.ZodType<O>; run: (input: z.infer<I>) => Promise<O> }): Promise<O>
export function jobStep<O>(opts: { outputSchema?: z.ZodType<O>; run: () => Promise<O> }): Promise<O>
export function jobStep(opts: { input?: unknown; inputSchema?: z.ZodType; outputSchema?: z.ZodType; run: (input?: unknown) => Promise<unknown> }): Promise<unknown> {
    // Synchronous guard so an un-awaited jobStep() still throws at the call site
    // instead of floating as an unhandled rejection.
    if (!Reflect.get(globalThis, Symbol.for("WORKFLOW_USE_STEP"))) {
        throw new DurableOnlyError("jobStep() is only available in durable jobs. Add `durable: true` to this job.")
    }
    return runJobStep(opts)
}

async function runJobStep(opts: { input?: unknown; inputSchema?: z.ZodType; outputSchema?: z.ZodType; run: (input?: unknown) => Promise<unknown> }): Promise<unknown> {
    const input = opts.inputSchema ? opts.inputSchema.parse(opts.input) : undefined
    const result = await opts.run(input)
    return opts.outputSchema ? opts.outputSchema.parse(result) : result
}

declare global {
    interface Promise<T> {
        /**
         * Runs this call as a journaled durable step: `client.method(args).asStep()`.
         * The durable build hoists the call into a step, so `asStep()` must be chained
         * directly onto the call, and its arguments and resolved value must be
         * serializable. Only available in durable jobs.
         */
        asStep(): Promise<T>
    }
}

// The durable build rewrites every valid `.asStep()` call site away, so this body
// only runs where the transform could not apply. Fail loudly instead of leaving
// "asStep is not a function".
Object.defineProperty(Promise.prototype, "asStep", {
    value: function asStep(): never {
        throw new DurableOnlyError("asStep() is only available in durable jobs. Add `durable: true` and chain .asStep() directly onto the call, e.g. client.method(args).asStep(). Note it is only transformed inside files that call createJob().")
    },
    writable: true,
    configurable: true,
    enumerable: false
})

export function sleep(duration: string | number | Date): Promise<void> {
    if (!isDurableExecution()) {
        throw new DurableOnlyError("sleep() is only available in durable jobs. Add `durable: true` to this job.")
    }
    // Locally (`terse test`, no TERSE_RUN_ID) there is no suspend machinery, so skip the
    // wait and note what production would have done instead.
    if (!process.env.TERSE_RUN_ID) {
        console.log(`[terse] Skipping sleep locally — in production this run would suspend and resume after ${describeDuration(duration)}.`)
        return Promise.resolve()
    }
    return workflowSleep(duration as any)
}

function describeDuration(duration: string | number | Date): string {
    if (typeof duration === "string") return duration
    if (duration instanceof Date) return ms(Math.max(0, duration.getTime() - Date.now()), { long: true })
    return ms(duration, { long: true })
}

// Provider-neutral input targets and delivery refs; both unions live in terse-types.
// Adding a provider: extend those unions, add a target constructor here, and register
// an InputRequestProvider in the backend. Everything between is provider-agnostic.
export type InputTarget = SdkInputRequestTarget
export type InputDelivery = SdkInputRequestDelivery
type DeliveryFor<Target extends InputTarget> = Extract<InputDelivery, { provider: Target["provider"] }>

export type SlackInputTarget = Extract<InputTarget, { provider: "slack" }>

// channel takes a Slack channel id; use the generated constants, e.g. SlackChannel.Launches.channelId.
export function slack(target: { channel: string }): SlackInputTarget {
    return { provider: "slack", channelId: target.channel }
}

export type InputOption<Id extends string = string> = {
    id: Id
    label: string
    description?: string
    freeText?: boolean
}

export type InputRespondent = { provider: string; userId: string; displayName?: string }

export type InputResponse<Id extends string, Delivery extends InputDelivery = InputDelivery> = {
    choice: Id
    text?: string
    respondent: InputRespondent
    delivery: Delivery
}

export type WaitForInputParams<Options extends readonly InputOption[], Target extends InputTarget = InputTarget> = {
    via: Target
    prompt: string
    details?: Record<string, string>
    options: Options
}

export function waitForInput<const Options extends readonly InputOption[], Target extends InputTarget>(
    params: WaitForInputParams<Options, Target>
): Promise<InputResponse<Options[number]["id"], DeliveryFor<Target>>> {
    if (!isDurableExecution()) {
        throw new DurableOnlyError("waitForInput() is only available in durable jobs. Add `durable: true` to this job.")
    }
    if (!process.env.TERSE_RUN_ID) {
        return promptForInputLocally(params)
    }
    return waitForInputDurable(params)
}

// No sleep, no race, no park signal: the hook entity this journals IS the wait. The run
// parks by draining its queue and exiting; the backend reads the journal at exit and
// suspends the sandbox.
async function waitForInputDurable<Options extends readonly InputOption[], Target extends InputTarget>(
    params: WaitForInputParams<Options, Target>
): Promise<InputResponse<Options[number]["id"], DeliveryFor<Target>>> {
    const hook = createHook<SdkInputResponsePayload>()
    const delivery = await registerInputRequest(hook.token, params)
    if (delivery.provider !== params.via.provider) {
        throw new Error(`waitForInput: backend delivered via "${delivery.provider}" but the target was "${params.via.provider}"`)
    }
    const typedDelivery = delivery as DeliveryFor<Target>

    const payload = await hook
    hook.dispose()
    return {
        choice: payload.choice as Options[number]["id"],
        text: payload.text,
        respondent: payload.respondent,
        delivery: typedDelivery
    }
}

async function registerInputRequest(token: string, params: WaitForInputParams<readonly InputOption[], InputTarget>): Promise<InputDelivery> {
    const body: SdkInputRequestRegisterBody = {
        token,
        runId: process.env.TERSE_RUN_ID!,
        prompt: params.prompt,
        details: params.details,
        options: params.options.map(o => ({ id: o.id, label: o.label, description: o.description, freeText: o.freeText })),
        via: params.via
    }
    const response = await postInputRequestStep(ApiRoutes.SDK.INPUT_REQUEST, body)
    if (!response.ok) {
        throw new Error(`waitForInput: failed to deliver input request: HTTP ${response.status}: ${await response.text()}`)
    }
    const parsed = sdkInputRequestRegisterResponseSchema.parse(await response.json())
    if (!parsed.success || !parsed.delivery) {
        throw new Error(`waitForInput: failed to deliver input request: ${parsed.error ?? "registration failed"}`)
    }
    return parsed.delivery
}

// workflowFetch is the workflow stdlib's hoisted "use step" fetch, so the HTTP call is
// journaled and replays from cache instead of re-delivering on every workflow replay.
async function postInputRequestStep(route: string, body: unknown): Promise<Response> {
    const headers = { ...(await buildSdkRequestHeaders()), Accept: "application/json" }
    return workflowFetch(`${resolveTerseBackendUrl()}${route}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    })
}

async function promptForInputLocally<Options extends readonly InputOption[], Target extends InputTarget>(
    params: WaitForInputParams<Options, Target>
): Promise<InputResponse<Options[number]["id"], DeliveryFor<Target>>> {
    const answer = await runLocalInputPrompt({
        prompt: params.prompt,
        details: params.details,
        options: params.options.map(o => ({ id: o.id, label: o.label, description: o.description, freeText: o.freeText })),
        targetDescription: describeInputTarget(params.via)
    })
    return {
        choice: answer.choice as Options[number]["id"],
        text: answer.text,
        respondent: { provider: "local", userId: "local" },
        delivery: localDelivery(params.via)
    }
}

// A step so local durable tests prompt exactly once; replays return the journaled answer.
async function runLocalInputPrompt(params: {
    prompt: string
    details?: Record<string, string>
    options: SdkInputRequestOption[]
    targetDescription: string
}): Promise<{ choice: string; text?: string }> {
    "use step"
    const { isCancel, select, text } = await import("@clack/prompts")
    console.log(`[terse] waitForInput: in production this run would suspend and wait for a response via ${params.targetDescription}.`)
    for (const [key, value] of Object.entries(params.details ?? {})) {
        console.log(`  ${key}: ${value}`)
    }

    const choice = await select({
        message: params.prompt,
        options: params.options.map(o => ({ value: o.id, label: o.label, hint: o.description }))
    })
    if (isCancel(choice)) throw new Error("waitForInput: cancelled at local prompt")

    const option = params.options.find(o => o.id === choice)
    let freeTextAnswer: string | undefined
    if (option?.freeText) {
        const answer = await text({ message: `${option.label}:` })
        if (isCancel(answer)) throw new Error("waitForInput: cancelled at local prompt")
        freeTextAnswer = answer || undefined
    }

    return { choice: String(choice), text: freeTextAnswer }
}

function describeInputTarget(target: InputTarget): string {
    switch (target.provider) {
        case "slack":
            return `Slack channel ${target.channelId}`
    }
}

function localDelivery<Target extends InputTarget>(target: Target): DeliveryFor<Target> {
    switch (target.provider) {
        case "slack":
            return { provider: "slack", channelId: target.channelId, messageTs: "" } as DeliveryFor<Target>
    }
}

export enum EventType {
    TEXT = "text",
    FINAL_OUTPUT = "final_output",
    TOOL_CALL_PARAMS = "tool_call_params",
    TOOL_CALL_STARTED = "tool_call_started",
    TOOL_CALL_COMPLETED = "tool_call_completed",
    TOOL_APPROVAL_REQUESTED = "tool_approval_requested",
    ACTION = "action"
}

export interface TerseAgentResult {
    type: EventType
}

export class TextResult implements TerseAgentResult {
    type: EventType.TEXT
    text: string

    constructor(text: string) {
        this.type = EventType.TEXT
        this.text = text
    }
}

export class FinalOutputResult implements TerseAgentResult {
    type: EventType.FINAL_OUTPUT
    finalOutput: string

    constructor(finalOutput: string) {
        this.type = EventType.FINAL_OUTPUT
        this.finalOutput = finalOutput
    }
}

export class ToolCallParamsResult implements TerseAgentResult {
    type: EventType.TOOL_CALL_PARAMS
    toolCallParams: string

    constructor(toolCallParams: string) {
        this.type = EventType.TOOL_CALL_PARAMS
        this.toolCallParams = toolCallParams
    }
}

export class ToolCallStartedResult implements TerseAgentResult {
    type: EventType.TOOL_CALL_STARTED
    toolCallStarted: string

    constructor(toolCallStarted: string) {
        this.type = EventType.TOOL_CALL_STARTED
        this.toolCallStarted = toolCallStarted
    }
}

export class ToolCallCompletedResult implements TerseAgentResult {
    type: EventType.TOOL_CALL_COMPLETED
    toolCallCompleted: string

    constructor(toolCallCompleted: string) {
        this.type = EventType.TOOL_CALL_COMPLETED
        this.toolCallCompleted = toolCallCompleted
    }
}

export class ToolApprovalRequestedResult implements TerseAgentResult {
    type: EventType.TOOL_APPROVAL_REQUESTED
    toolApprovalRequested: {
        stepId: string
        toolName: string
        arguments: string
    }

    constructor(toolApprovalRequested: { stepId: string; toolName: string; arguments: string }) {
        this.type = EventType.TOOL_APPROVAL_REQUESTED
        this.toolApprovalRequested = toolApprovalRequested
    }
}

export class ActionResult implements TerseAgentResult {
    type: EventType.ACTION
    action: Action

    constructor(action: Action) {
        this.type = EventType.ACTION
        this.action = action
    }
}

async function* iterateSseDataLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            let separatorIndex = buffer.indexOf("\n\n")
            while (separatorIndex !== -1) {
                const rawEvent = buffer.slice(0, separatorIndex)
                buffer = buffer.slice(separatorIndex + 2)

                const dataLines = rawEvent
                    .split("\n")
                    .filter(line => line.startsWith("data:"))
                    .map(line => line.slice(5).trim())
                    .filter(Boolean)

                if (dataLines.length > 0) {
                    yield dataLines.join("\n")
                }

                separatorIndex = buffer.indexOf("\n\n")
            }
        }
    } finally {
        reader.releaseLock()
    }
}

function safeParseStreamEvent(raw: string): SdkAgentStreamEvent | null {
    try {
        return JSON.parse(raw) as SdkAgentStreamEvent
    } catch {
        return null
    }
}

function mapStreamEventToResult(event: SdkAgentStreamEvent): TerseAgentResult {
    switch (event.type) {
        case "text":
            return new TextResult(event.text)
        case "final_output":
            return new FinalOutputResult(event.finalOutput)
        case "tool_call_params":
            return new ToolCallParamsResult(event.toolCallParams)
        case "tool_call_started":
            return new ToolCallStartedResult(event.toolCallStarted)
        case "tool_call_completed":
            return new ToolCallCompletedResult(event.toolCallCompleted)
        case "tool_approval_requested":
            return new ToolApprovalRequestedResult(event.toolApprovalRequested)
        case "action":
            return new ActionResult(event.action)
        case "done":
        case "error":
            return new TextResult("")
        default:
            return new TextResult("")
    }
}

function parseToolCallCompleted(raw: string): { tool?: string; status?: string } | null {
    try {
        return JSON.parse(raw) as { tool?: string; status?: string }
    } catch {
        return null
    }
}

type StateAccessorImpl = {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<unknown>
}
