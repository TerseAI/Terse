declare const process: { env: Record<string, string | undefined> }

import type { InputEvent, ToolboxEntry } from "./types.js"
import type { ConfigInstance } from "./shared/Configs.js"
import type { RunHistoryAction } from "./shared/RunHistoryTypes.js"
import { IntegrationType } from "./shared/Integrations.js"
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

export { IntegrationType } from "./shared/Integrations.js"

export {
    RunHistoryAction,
    RunHistoryStatus,
    RunHistoryTrigger,
    RunHistoryDecision,
    RunHistoryRecord
} from "./shared/RunHistoryTypes.js"

// SDK types

type ToolBox = ToolboxEntry[]
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
    private readonly prompt: string
    private readonly toolBox: ToolBox

    constructor(prompt: string, toolBox: ToolBox) {
        this.prompt = prompt
        this.toolBox = toolBox
    }

    async *run(prompt: string, event: InputEvent): AsyncGenerator<TerseAgentResult> {
        yield new TextResult("Hello, world!")
        return
    }

    async executeTool(toolName: string, params: Record<string, unknown> = {}): Promise<unknown> {
        const apiKey = process.env.TERSE_API_KEY
        if (!apiKey) {
            throw new Error("TERSE_API_KEY environment variable is not set. Cannot execute tools without authentication.")
        }
        const res = await fetch("http://localhost:3001/sdk/tool-execute", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ toolName, params })
        })
        const data = (await res.json()) as { success: boolean; result?: unknown; error?: string }
        if (!data.success) {
            throw new Error(data.error ?? "Tool execution failed")
        }
        return data.result
    }
}

export enum EventType {
    TEXT = "text",
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