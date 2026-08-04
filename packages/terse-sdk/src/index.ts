import ms from "ms"
import type {
    RunHistoryAction,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    SdkApprovalDecisionRequestBody,
    SdkStateGetRequest,
    SdkStatePutRequest,
    WebhookJobChallengeResponse,
    WebhookJobTriggerResponse
} from "terse-types"
import {
    ApiRoutes,
    IntegrationType,
    sdkAgentRunRequestBodySchema,
    sdkStateGetResponseSchema,
    stripZodJsonSchemaMetadata,
    webhookJobChallengeRequestSchema,
    webhookJobTriggerRequestSchema
} from "terse-types"
// The type-erased base event type, enriched with the SDK methods (formatForAgentRunner/debugLog).
// Concrete trigger types are generated into the user's workspace by `terse generate`.
import type { Trigger as _RawTrigger } from "terse-types"
import { sleep as workflowSleep } from "workflow"
import { z } from "zod"

import { buildSdkRequestHeaders, resolveApiBaseUrl, resolveTerseBackendUrl } from "./backendRequest.js"
import { claimAgentApprovalHandling, releaseAgentApprovalHandling } from "./context.js"
import { DurableOnlyError, isDurableExecution, isLocalTestRun } from "./execution.js"
import { computeChallengeSignature, verifyIncomingRequest } from "./hmac.js"
import { resolveRunIdentity } from "./runIdentity/index.js"
import { openSessionStream } from "./sessionStream.js"
import {
    type InferEvents,
    type InferToolApprovals,
    type SDKTrigger,
    type StateAccessor,
    type StateDefinition,
    type TriggerLike,
    type TypedSkill,
    type TypedTrigger,
    createSDKTrigger
} from "./types.js"

declare const process: { env: Record<string, string | undefined> }

export const TERSE_JOB_WEBHOOK_TRIGGER_PATH = ApiRoutes.SDK.JOB_WEBHOOK_TRIGGER

export { DurableOnlyError } from "./execution.js"

export { slack, waitForInput } from "./inputRequest.js"
export type { InputDelivery, InputImage, InputOption, InputRespondent, InputResponse, InputTarget, SlackInputTarget, WaitForInputParams } from "./inputRequest.js"

export { isAgentApprovalHandlingClaimed } from "./context.js"
export type { TerseJobContext } from "./context.js"

export { pollUntil } from "./poll.js"
export type { PollUntilOptions } from "./poll.js"

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
    TriggerLike,
    TypedSkill,
    TypedTrigger
} from "./types.js"

// Re-export shared types for consumer convenience
export {
    ApolloOutputConfig,
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
    GoogleSearchConsoleOutputConfig,
    HeyReachEventType,
    HeyReachInputConfig,
    ImageEditConfig,
    LaunchDarklyConfig,
    LinearEventType,
    LinearInputConfig,
    LinearOutputConfig,
    MemoryConfig,
    MetaAdsOutputConfig,
    NotionConfig,
    PosthogConfig,
    ResendOutputConfig,
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

export { FrequencyUnit, IntegrationType } from "terse-types"
export { TIMEZONES } from "terse-types"
export type { Timezone } from "terse-types"
export type { SdkAgentRunOptionsPayload, SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentStreamEvent, ToolInputByName, ToolOutputByName } from "terse-types"
export type { SlackAttachments, SlackBlocks, SlackFiles } from "terse-types"

export { RunHistoryAction, RunHistoryDecision, RunHistoryRecord, RunHistoryStatus, RunHistoryTrigger } from "terse-types"

// SDK types

type Action = RunHistoryAction

export type CreateJobParameters<TTriggers extends readonly TypedTrigger<TriggerLike>[] = TypedTrigger<TriggerLike>[], TStates extends readonly StateDefinition[] = readonly StateDefinition[]> = {
    name: string
    triggers: [...TTriggers]
    states?: [...TStates]
    filter?: (event: InferEvents<TTriggers>, state: StateAccessor<TStates>) => boolean | Promise<boolean>
    onTrigger: (event: InferEvents<TTriggers>, state: StateAccessor<TStates>) => Promise<void>
    remoteServerUrl?: string
    durable?: boolean
}

export function createJob<TTriggers extends readonly TypedTrigger<TriggerLike>[], const TStates extends readonly StateDefinition[] = readonly []>(params: CreateJobParameters<TTriggers, TStates>) {
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

function registerJob<TTriggers extends readonly TypedTrigger<TriggerLike>[]>(job: CreateJobParameters<TTriggers>): void {
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

/**
 * Runs the wrapped call as a journaled durable step: `step(client.method(args))`.
 * The durable build hoists the call into a step, so `step()` must wrap the call
 * directly, and its arguments and resolved value must be serializable. Only
 * available in durable jobs.
 */
// The durable build rewrites every valid step() call site away, so this body only
// runs where the transform could not apply. Fail loudly either way.
export function step<T>(promise: Promise<T>): Promise<T> {
    throw new DurableOnlyError(
        "step() is only available in durable jobs. Add `durable: true` and wrap the call directly, e.g. step(client.method(args)). Note it is only transformed inside files that call createJob()."
    )
}

/**
 * Replay-safe logging for durable jobs: `await log("processed", count)`.
 * In workflow code the call is a journaled step, so the line prints exactly
 * once instead of once per replay like a bare `console.log` outside a step
 * would. Arguments cross the step boundary, so they must be serializable.
 * Inside step bodies and non-durable jobs it simply forwards to `console.log`.
 */
export async function log(...args: unknown[]): Promise<void> {
    "use step"
    console.log(...args)
}

export function sleep(duration: string | number | Date): Promise<void> {
    if (!isDurableExecution()) {
        throw new DurableOnlyError("sleep() is only available in durable jobs. Add `durable: true` to this job.")
    }
    // Locally there is no suspend machinery, so skip the wait and note what production
    // would have done instead.
    if (isLocalTestRun()) {
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
