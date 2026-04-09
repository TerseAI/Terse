import type { ConfigData } from "terse-types"
import type {
    CronTriggerEvent as BaseCronTriggerEvent,
    GitHubPullRequestClosedTriggerEvent as BaseGitHubPullRequestClosedTriggerEvent,
    GitHubPullRequestMergedTriggerEvent as BaseGitHubPullRequestMergedTriggerEvent,
    GitHubPullRequestOpenedTriggerEvent as BaseGitHubPullRequestOpenedTriggerEvent,
    GitHubPullRequestSynchronizedTriggerEvent as BaseGitHubPullRequestSynchronizedTriggerEvent,
    GitHubPullRequestTriggerEvent as BaseGitHubPullRequestTriggerEvent,
    GitHubPushTriggerEvent as BaseGitHubPushTriggerEvent,
    GitHubTriggerEvent as BaseGitHubTriggerEvent,
    GmailTriggerEvent as BaseGmailTriggerEvent,
    LinearCommentCreatedTriggerEvent as BaseLinearCommentCreatedTriggerEvent,
    LinearIssueCreatedTriggerEvent as BaseLinearIssueCreatedTriggerEvent,
    LinearIssueUpdatedTriggerEvent as BaseLinearIssueUpdatedTriggerEvent,
    LinearTriggerEvent as BaseLinearTriggerEvent,
    ManualSampleTriggerEvent as BaseManualSampleTriggerEvent,
    SdkAgentRunOptionsPayload as BaseSdkAgentRunOptionsPayload,
    SlackAppMentionTriggerEvent as BaseSlackAppMentionTriggerEvent,
    SlackMessageTriggerEvent as BaseSlackMessageTriggerEvent,
    SlackReactionAddedTriggerEvent as BaseSlackReactionAddedTriggerEvent,
    SlackTriggerEvent as BaseSlackTriggerEvent,
    TriggerEvent as BaseTriggerEvent,
    WebhookTriggerEvent as BaseWebhookTriggerEvent,
    WorkOSInvitationAcceptedTriggerEvent as BaseWorkOSInvitationAcceptedTriggerEvent,
    WorkOSInvitationCreatedTriggerEvent as BaseWorkOSInvitationCreatedTriggerEvent,
    WorkOSInvitationResentTriggerEvent as BaseWorkOSInvitationResentTriggerEvent,
    WorkOSInvitationRevokedTriggerEvent as BaseWorkOSInvitationRevokedTriggerEvent,
    WorkOSInvitationTriggerEvent as BaseWorkOSInvitationTriggerEvent,
    WorkOSMembershipTriggerEvent as BaseWorkOSMembershipTriggerEvent,
    WorkOSOrganizationMembershipCreatedTriggerEvent as BaseWorkOSOrganizationMembershipCreatedTriggerEvent,
    WorkOSOrganizationMembershipDeletedTriggerEvent as BaseWorkOSOrganizationMembershipDeletedTriggerEvent,
    WorkOSOrganizationMembershipUpdatedTriggerEvent as BaseWorkOSOrganizationMembershipUpdatedTriggerEvent,
    WorkOSOrganizationTriggerEvent as BaseWorkOSOrganizationTriggerEvent,
    WorkOSTriggerEvent as BaseWorkOSTriggerEvent,
    WorkOSUserCreatedTriggerEvent as BaseWorkOSUserCreatedTriggerEvent,
    WorkOSUserDeletedTriggerEvent as BaseWorkOSUserDeletedTriggerEvent,
    WorkOSUserTriggerEvent as BaseWorkOSUserTriggerEvent,
    WorkOSUserUpdatedTriggerEvent as BaseWorkOSUserUpdatedTriggerEvent,
    RunHistoryAction,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    SdkApprovalDecisionRequestBody,
    ToolInputByName,
    ToolOutputByName
} from "terse-types"
import { IntegrationType } from "terse-types"
import { ApiRoutes } from "terse-types"
import { sdkAgentRunRequestBodySchema } from "terse-types"

import type { InferEvents, InferToolApprovals, SDKTriggerEvent, TypedSkill, TypedTrigger } from "./types.js"

declare const process: { env: Record<string, string | undefined> }

// Re-export SDK-specific types
export type { ToolboxEntry, SDKTriggerEvent, TypedTrigger, TypedSkill, InferEvent, InferEvents, InferToolApproval, InferToolApprovals } from "./types.js"

// Re-export shared types for consumer convenience
export {
    ConfigType,
    ConfigInstance,
    GmailConfig,
    SlackConfig,
    SlackOutputConfig,
    GmailOutputConfig,
    GmailDraftOutputConfig,
    NotionConfig,
    LinearInputConfig,
    LinearOutputConfig,
    GitHubConfig,
    PosthogConfig,
    DatadogConfig,
    TimeTriggerConfig,
    LaunchDarklyConfig,
    TerseConfig,
    WorkOSInputConfig,
    WorkOSOutputConfig,
    AttioOutputConfig,
    SnowflakeOutputConfig,
    WebhookInputConfig,
    SlackEventType,
    GitHubEventType,
    LinearEventType,
    GmailEventType,
    WorkOSEventType,
    debugTriggerEvent,
    formatTriggerEventForAgent
} from "terse-types"

export type SdkAgentRunOptionsPayload = BaseSdkAgentRunOptionsPayload
export type TriggerEvent = SDKTriggerEvent<BaseTriggerEvent>
export type CronTriggerEvent = SDKTriggerEvent<BaseCronTriggerEvent>
export type GitHubPullRequestClosedTriggerEvent = SDKTriggerEvent<BaseGitHubPullRequestClosedTriggerEvent>
export type GitHubPullRequestMergedTriggerEvent = SDKTriggerEvent<BaseGitHubPullRequestMergedTriggerEvent>
export type GitHubPullRequestOpenedTriggerEvent = SDKTriggerEvent<BaseGitHubPullRequestOpenedTriggerEvent>
export type GitHubPullRequestSynchronizedTriggerEvent = SDKTriggerEvent<BaseGitHubPullRequestSynchronizedTriggerEvent>
export type GitHubPullRequestTriggerEvent = SDKTriggerEvent<BaseGitHubPullRequestTriggerEvent>
export type GitHubPushTriggerEvent = SDKTriggerEvent<BaseGitHubPushTriggerEvent>
export type GitHubTriggerEvent = SDKTriggerEvent<BaseGitHubTriggerEvent>
export type GmailTriggerEvent = SDKTriggerEvent<BaseGmailTriggerEvent>
export type LinearCommentCreatedTriggerEvent = SDKTriggerEvent<BaseLinearCommentCreatedTriggerEvent>
export type LinearIssueCreatedTriggerEvent = SDKTriggerEvent<BaseLinearIssueCreatedTriggerEvent>
export type LinearIssueUpdatedTriggerEvent = SDKTriggerEvent<BaseLinearIssueUpdatedTriggerEvent>
export type LinearTriggerEvent = SDKTriggerEvent<BaseLinearTriggerEvent>
export type ManualSampleTriggerEvent = SDKTriggerEvent<BaseManualSampleTriggerEvent>
export type SlackAppMentionTriggerEvent = SDKTriggerEvent<BaseSlackAppMentionTriggerEvent>
export type SlackMessageTriggerEvent = SDKTriggerEvent<BaseSlackMessageTriggerEvent>
export type SlackReactionAddedTriggerEvent = SDKTriggerEvent<BaseSlackReactionAddedTriggerEvent>
export type SlackTriggerEvent = SDKTriggerEvent<BaseSlackTriggerEvent>
export type WebhookTriggerEvent = SDKTriggerEvent<BaseWebhookTriggerEvent>
export type WorkOSInvitationAcceptedTriggerEvent = SDKTriggerEvent<BaseWorkOSInvitationAcceptedTriggerEvent>
export type WorkOSInvitationCreatedTriggerEvent = SDKTriggerEvent<BaseWorkOSInvitationCreatedTriggerEvent>
export type WorkOSInvitationTriggerEvent = SDKTriggerEvent<BaseWorkOSInvitationTriggerEvent>
export type WorkOSInvitationResentTriggerEvent = SDKTriggerEvent<BaseWorkOSInvitationResentTriggerEvent>
export type WorkOSInvitationRevokedTriggerEvent = SDKTriggerEvent<BaseWorkOSInvitationRevokedTriggerEvent>
export type WorkOSOrganizationMembershipCreatedTriggerEvent = SDKTriggerEvent<BaseWorkOSOrganizationMembershipCreatedTriggerEvent>
export type WorkOSOrganizationMembershipDeletedTriggerEvent = SDKTriggerEvent<BaseWorkOSOrganizationMembershipDeletedTriggerEvent>
export type WorkOSOrganizationMembershipUpdatedTriggerEvent = SDKTriggerEvent<BaseWorkOSOrganizationMembershipUpdatedTriggerEvent>
export type WorkOSMembershipTriggerEvent = SDKTriggerEvent<BaseWorkOSMembershipTriggerEvent>
export type WorkOSOrganizationTriggerEvent = SDKTriggerEvent<BaseWorkOSOrganizationTriggerEvent>
export type WorkOSTriggerEvent = SDKTriggerEvent<BaseWorkOSTriggerEvent>
export type WorkOSUserCreatedTriggerEvent = SDKTriggerEvent<BaseWorkOSUserCreatedTriggerEvent>
export type WorkOSUserDeletedTriggerEvent = SDKTriggerEvent<BaseWorkOSUserDeletedTriggerEvent>
export type WorkOSUserUpdatedTriggerEvent = SDKTriggerEvent<BaseWorkOSUserUpdatedTriggerEvent>
export type WorkOSUserTriggerEvent = SDKTriggerEvent<BaseWorkOSUserTriggerEvent>
export type { SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentStreamEvent, ToolInputByName, ToolOutputByName }
export { IntegrationType } from "terse-types"

export { RunHistoryAction, RunHistoryStatus, RunHistoryTrigger, RunHistoryDecision, RunHistoryRecord } from "terse-types"

// SDK types

type Action = RunHistoryAction

export type CreateJobParameters<TTriggers extends readonly TypedTrigger[] = TypedTrigger[], TSkills extends readonly TypedSkill<string>[] = readonly TypedSkill<string>[]> = {
    name: string
    triggers: [...TTriggers]
    skills: [...TSkills]
    toolApprovals?: InferToolApprovals<TSkills>[]
    filter?: (event: InferEvents<TTriggers>) => boolean | Promise<boolean>
    onTrigger: (event: InferEvents<TTriggers>, Agent: TerseAgent) => Promise<void>
    webhookURL?: string
}

/** Internal job registry — lives on globalThis so it survives across module instances (e.g. tsx loaders). */
const _global = globalThis as unknown as { __terse_jobRegistry?: Map<string, CreateJobParameters> }
_global.__terse_jobRegistry ??= new Map<string, CreateJobParameters>()
export const _jobRegistry: Map<string, CreateJobParameters> = _global.__terse_jobRegistry

export class Terse {
    constructor() {
        // fetch api_key from env
    }

    createJob<TTriggers extends readonly TypedTrigger[], TSkills extends readonly TypedSkill<string>[]>(params: CreateJobParameters<TTriggers, TSkills>) {
        const webhookCount = params.triggers.filter(t => t.integrationType === IntegrationType.WEBHOOK).length
        if (webhookCount > 1) {
            throw new Error(`Job "${params.name}" has ${webhookCount} webhook triggers. Only one webhook trigger per job is allowed.`)
        }
        _jobRegistry.set(params.name, params as unknown as CreateJobParameters)
    }
}

export type ApprovalRequestInfo = {
    stepId: string
    toolName: string
    arguments: string
}

export class TerseAgent {
    readonly skills: ConfigData[]
    manualToolConfigs?: readonly ConfigData[]
    readonly toolApprovals: string[]
    private readonly apiBaseUrl: string
    private readonly sessionId?: string

    /**
     * Optional callback invoked when the agent requires tool approval.
     * Return `true` to approve, `false` to reject.
     * If not set, approval events are yielded as ToolApprovalRequestedResult
     * but no decision is submitted (the stream will hang waiting).
     */
    onApprovalRequired?: (info: ApprovalRequestInfo) => Promise<boolean>

    constructor(skills: ConfigData[] = [], apiBaseUrl: string = "http://localhost:3001", sessionId?: string, toolApprovals: string[] = []) {
        this.skills = skills
        this.apiBaseUrl = apiBaseUrl
        this.sessionId = sessionId
        this.toolApprovals = toolApprovals
    }

    async *run(prompt: string, event?: BaseTriggerEvent): AsyncGenerator<TerseAgentResult> {
        const resolvedEvent = event

        const requestBody: SdkAgentRunRequestBody = sdkAgentRunRequestBodySchema.parse({
            prompt,
            toolApprovals: this.toolApprovals,
            event: resolvedEvent,
            skills: this.skills
        })

        const res = await fetch(`${this.apiBaseUrl}${ApiRoutes.SDK.AGENT_RUN}`, {
            method: "POST",
            headers: this.buildHeaders(),
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
    }

    async submitApprovalDecision(params: { runId: string; stepId: string; approved: boolean }): Promise<void> {
        const res = await fetch(`${this.apiBaseUrl}${ApiRoutes.SDK.APPROVAL_DECISION}`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify(params satisfies SdkApprovalDecisionRequestBody)
        })

        if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
            throw new Error(`Approval decision failed: ${data.error ?? res.statusText}`)
        }
    }

    /**
     * Runs the agent to completion and discards streamed output.
     * Useful when you only care that the run finished (or threw).
     */
    async runAndWait(prompt: string, event?: BaseTriggerEvent): Promise<string> {
        for await (const chunk of this.run(prompt, event)) {
            if (chunk.type === EventType.FINAL_OUTPUT) {
                return (chunk as FinalOutputResult).finalOutput
            }
        }

        throw new Error("Run completed without final output")
    }

    async executeTool<TOutput = unknown>(toolName: string, params: Record<string, unknown> = {}): Promise<TOutput> {
        const res = await fetch(`${this.apiBaseUrl}${ApiRoutes.SDK.TOOL_EXECUTE}`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify({ toolName, params })
        })
        const data = (await res.json()) as { success: boolean; result?: unknown; error?: string }
        if (!data.success) {
            throw new Error(data.error ?? "Tool execution failed")
        }
        return data.result as TOutput
    }

    private buildHeaders(): Record<string, string> {
        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY environment variable is not set.")
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream"
        }
        if (this.sessionId) headers["X-Terse-Session-Id"] = this.sessionId
        const runId = process.env.TERSE_RUN_ID
        if (runId) headers["X-Terse-Run-Id"] = runId
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
