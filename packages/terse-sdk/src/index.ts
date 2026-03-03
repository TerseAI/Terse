declare const process: { env: Record<string, string | undefined> }

import type { InputEvent } from "./types.js"
import { CONFIG_DETAILS } from "./shared/Configs.js"
import type { ConfigInstance } from "./shared/Configs.js"
import type { RunHistoryAction } from "./shared/RunHistoryTypes.js"
import type { SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentSkillPayload, SdkAgentStreamEvent } from "./shared/types.js"
import { IntegrationType } from "./shared/Integrations.js"
import { ApiRoutes } from "./shared/ApiRoutes.js"
// Re-export SDK-specific types
export type { InputEvent, ToolboxEntry } from "./types.js"

// Mock event for CLI's `terse run` command
export class MockInputEvent implements InputEvent {
    readonly integrationType = IntegrationType.TERSE

    formatForAgentRunner(): string {
        return "Manual trigger from terse run"
    }

    debugLog(): string {
        return "[MockInputEvent] Manual trigger via CLI"
    }
}

// Re-export shared types for consumer convenience
export {
    ConfigType,
    ConfigInstance,
    GmailConfig,
    FigmaConfig,
    SlackConfig,
    SlackOutputConfig,
    GmailOutputConfig,
    GmailDraftOutputConfig,
    NotionConfig,
    LinearInputConfig,
    LinearOutputConfig,
    GitHubConfig,
    JiraConfig,
    ConfluenceConfig,
    PosthogConfig,
    DatadogConfig,
    TimeTriggerConfig,
    LaunchDarklyConfig,
    TerseConfig,
    WorkOSInputConfig,
    AttioOutputConfig
} from "./shared/Configs.js"

export type {
    SdkAgentRunEventPayload,
    SdkAgentSkillPayload,
    SdkAgentRunOptionsPayload,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    ToolOutputByName
} from "./shared/types.js"

export { IntegrationType } from "./shared/Integrations.js"

export {
    RunHistoryAction,
    RunHistoryStatus,
    RunHistoryTrigger,
    RunHistoryDecision,
    RunHistoryRecord
} from "./shared/RunHistoryTypes.js"

// SDK types

type Action = RunHistoryAction

export type FilterConfiguration = {
    criteria: string
}

export type CreateJobParameters = {
    name: string
    triggers: ConfigInstance[]
    skills: ConfigInstance[]
    filterConfiguration?: FilterConfiguration[]
    onTrigger: (event: InputEvent, Agent: TerseAgent) => Promise<void>
    webhookURL: string
}

/** Internal job registry — lives on globalThis so it survives across module instances (e.g. tsx loaders). */
const _global = globalThis as unknown as { __terse_jobRegistry?: Map<string, CreateJobParameters> }
_global.__terse_jobRegistry ??= new Map<string, CreateJobParameters>()
export const _jobRegistry: Map<string, CreateJobParameters> = _global.__terse_jobRegistry

export class Terse {
    constructor() {
        // fetch api_key from env
    }

    createJob(params: CreateJobParameters) {
        _jobRegistry.set(params.name, params)
        // Deploy the job, run code in Modal Sandbox etc...
    }
}

export class TerseAgent {
    readonly skills: ConfigInstance[]
    private readonly apiBaseUrl: string
    private readonly sessionId?: string

    constructor(skills: ConfigInstance[] = [], apiBaseUrl: string = "http://localhost:3001", sessionId?: string) {
        this.skills = skills
        this.apiBaseUrl = apiBaseUrl
        this.sessionId = sessionId
    }

    async *run(prompt: string, event?: InputEvent): AsyncGenerator<TerseAgentResult> {
        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY environment variable is not set. Cannot run agent without authentication.")
        }

        const resolvedEvent = event ?? new MockInputEvent()
        const skills: SdkAgentSkillPayload[] = this.skills.map(skill => ({
            configType: skill.configType,
            config: serializeSkillConfig(skill)
        }))

        const requestBody: SdkAgentRunRequestBody = {
            prompt,
            event: {
                integrationType: resolvedEvent.integrationType,
                formattedContent: resolvedEvent.formatForAgentRunner(),
                debugLog: resolvedEvent.debugLog()
            },
            skills
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream"
        }
        if (this.sessionId) headers["X-Terse-Session-Id"] = this.sessionId
        const runId = process.env.TERSE_RUN_ID
        if (runId) headers["X-Terse-Run-Id"] = runId

        const res = await fetch(`${this.apiBaseUrl}${ApiRoutes.SDK.AGENT_RUN}`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        })

        const contentType = res.headers.get("content-type") ?? ""
        if (contentType.includes("text/event-stream")) {
            if (!res.body) {
                throw new Error("Agent run stream did not provide a response body.")
            }
            const failedToolCalls: string[] = []
            for await (const eventData of iterateSseDataLines(res.body)) {
                const parsed = safeParseStreamEvent(eventData)
                if (!parsed) continue
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
                yield mapStreamEventToResult(parsed)
            }
            return
        }

        const data = (await res.json()) as SdkAgentRunResponseBody
        if (!res.ok || !data.success) {
            const details = data.details?.length ? ` (${data.details.join("; ")})` : ""
            throw new Error(`${data.error ?? "Agent run failed"}${details}`)
        }

        yield new TextResult("Agent run request accepted.")
        return
    }

    /**
     * Runs the agent to completion and discards streamed output.
     * Useful when you only care that the run finished (or threw).
     */
    async runAndWait(prompt: string, event?: InputEvent): Promise<void> {
        for await (const _chunk of this.run(prompt, event)) {
            // Intentionally drain the stream without returning output.
        }
    }

    async executeTool<TOutput = unknown>(toolName: string, params: Record<string, unknown> = {}): Promise<TOutput> {
        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY environment variable is not set. Cannot execute tools without authentication.")
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
        if (this.sessionId) headers["X-Terse-Session-Id"] = this.sessionId
        const toolRunId = process.env.TERSE_RUN_ID
        if (toolRunId) headers["X-Terse-Run-Id"] = toolRunId

        const res = await fetch(`${this.apiBaseUrl}${ApiRoutes.SDK.TOOL_EXECUTE}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ toolName, params })
        })
        const data = (await res.json()) as { success: boolean; result?: unknown; error?: string }
        if (!data.success) {
            throw new Error(data.error ?? "Tool execution failed")
        }
        return data.result as TOutput
    }
}

function serializeSkillConfig(skill: ConfigInstance): Record<string, unknown> {
    const serialized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(skill as unknown as Record<string, unknown>)) {
        if (typeof value === "function" || value === undefined) continue
        serialized[key] = value
    }
    const details = CONFIG_DETAILS[skill.configType]
    serialized.integrationType = details.integrationType
    serialized.configType = skill.configType
    return serialized
}

export enum EventType {
    TEXT = "text",
    FINAL_OUTPUT = "final_output",
    TOOL_CALL_PARAMS = "tool_call_params",
    TOOL_CALL_STARTED = "tool_call_started",
    TOOL_CALL_COMPLETED = "tool_call_completed",
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