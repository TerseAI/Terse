import type {
    RunHistoryAction,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    SdkApprovalDecisionRequestBody,
    WebhookJobChallengeResponse,
    WebhookJobTriggerResponse
} from "terse-types"
import { ApiRoutes, IntegrationType, sdkAgentRunRequestBodySchema, stripZodJsonSchemaMetadata, webhookJobChallengeRequestSchema, webhookJobTriggerRequestSchema } from "terse-types"
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
import { z } from "zod"

import { claimAgentApprovalHandling, getJobContext, releaseAgentApprovalHandling, runWithJobContext } from "./context.js"
import { computeChallengeSignature, verifyIncomingRequest } from "./hmac.js"
import { openSessionStream } from "./sessionStream.js"
import { type InferEvents, InferStructuredOutput, type InferToolApprovals, type SDKTrigger, type TypedSkill, type TypedTrigger, createSDKTrigger } from "./types.js"

declare const process: { env: Record<string, string | undefined> }

function resolveTerseBackendUrl(): string {
    return process.env.TERSE_BACKEND_URL || "https://api.useterse.ai"
}

function resolveApiBaseUrl(): string {
    return getJobContext()?.apiBaseUrl ?? resolveTerseBackendUrl()
}

export const TERSE_JOB_WEBHOOK_TRIGGER_PATH = ApiRoutes.SDK.JOB_WEBHOOK_TRIGGER

export { getJobContext, isAgentApprovalHandlingClaimed, runWithJobContext } from "./context.js"
export type { TerseJobContext } from "./context.js"

export { SessionStreamError, openListenStream, openSessionStream } from "./sessionStream.js"
export type { ListenStreamHandle, OpenListenStreamOptions, OpenSessionStreamOptions, SessionStartedEvent, SessionStreamEvent, SessionStreamHandle } from "./sessionStream.js"

// Re-export SDK-specific types
export { createSDKTrigger, registerEventTransform } from "./types.js"
export type { InferEvent, InferEvents, InferStructuredOutput, InferToolApproval, InferToolApprovals, SDKTrigger, ToolboxEntry, TypedSkill, TypedTrigger } from "./types.js"

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

export type CreateJobParameters<TTriggers extends readonly TypedTrigger[] = TypedTrigger[]> = {
    name: string
    triggers: [...TTriggers]
    filter?: (event: InferEvents<TTriggers>) => boolean | Promise<boolean>
    onTrigger: (event: InferEvents<TTriggers>) => Promise<void>
    remoteServerUrl?: string
}

export function createJob<TTriggers extends readonly TypedTrigger[]>(params: CreateJobParameters<TTriggers>) {
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

        verifyIncomingRequest(signingSecret, headers, JSON.stringify(body))

        const challenge = webhookJobChallengeRequestSchema.safeParse(body)
        if (challenge.success) {
            const signature = computeChallengeSignature(signingSecret, challenge.data.challenge)
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
            const result = await runWithJobContext({ sessionId: session.sessionId, runId, apiBaseUrl }, async () => {
                const inputEvent = createSDKTrigger(event)

                if (job.filter) {
                    const shouldRun = await job.filter(inputEvent)
                    if (!shouldRun) {
                        return { status: "ok" as const, filtered: true }
                    }
                }
                await job.onTrigger(inputEvent)

                return { status: "ok" as const }
            })

            return result
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
        const requestBody: SdkAgentRunRequestBody = sdkAgentRunRequestBodySchema.parse({
            prompt: this.prompt,
            toolApprovals: this.toolApprovals,
            message: userMessage,
            skills: this.skills,
            outputSchema: outputSchema ? (stripZodJsonSchemaMetadata(z.toJSONSchema(outputSchema)) as Record<string, unknown>) : undefined
        })

        // Claim approval handling for this run if the caller wired up its own
        // callback, so the CLI's session-stream handler won't also prompt and
        // submit a decision for the same stepId.
        const ownsApprovals = !!this.onApprovalRequired
        if (ownsApprovals) claimAgentApprovalHandling()

        try {
            const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.AGENT_RUN}`, {
                method: "POST",
                headers: TerseAgent.buildHeaders(),
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
        const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.APPROVAL_DECISION}`, {
            method: "POST",
            headers: TerseAgent.buildHeaders(),
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
        for await (const chunk of this.run(userMessage, outputSchema)) {
            if (chunk.type === EventType.FINAL_OUTPUT) {
                const raw = (chunk as FinalOutputResult).finalOutput
                if (!outputSchema) return raw
                return outputSchema.parse(JSON.parse(raw)) as z.infer<OutputSchema>
            }
        }

        throw new Error("Run completed without final output")
    }

    static async executeTool<TOutput = unknown>(toolName: string, params: Record<string, unknown> = {}): Promise<TOutput> {
        const res = await fetch(`${resolveApiBaseUrl()}${ApiRoutes.SDK.TOOL_EXECUTE}`, {
            method: "POST",
            headers: TerseAgent.buildHeaders(),
            body: JSON.stringify({ toolName, params })
        })
        const data = (await res.json()) as { success: boolean; result?: unknown; error?: string }
        if (!data.success) {
            throw new Error(data.error ?? "Tool execution failed")
        }
        return data.result as TOutput
    }

    private static buildHeaders(): Record<string, string> {
        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY environment variable is not set.")
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream"
        }
        const ctx = getJobContext()
        if (ctx?.sessionId) headers["X-Terse-Session-Id"] = ctx.sessionId
        const runIdHeader = ctx?.runId ?? process.env.TERSE_RUN_ID
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
        prompt: "",
        skills: params.skills ? [...params.skills] : [],
        toolApprovals: params.toolApprovals
    })
    if ("outputSchema" in params) {
        return await agent.runAndWait(params.prompt, params.outputSchema)
    }
    return await agent.runAndWait(params.prompt)
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
