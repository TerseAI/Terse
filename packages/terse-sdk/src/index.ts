import type { InputEvent, ToolboxEntry } from "./types"
import type { ConfigInstance } from "./shared/Configs"
import type { RunHistoryAction } from "./shared/RunHistoryTypes"

// Re-export SDK-specific types
export type { InputEvent, ToolboxEntry } from "./types"

// Re-export mocks for CLI usage
export { MockInputEvent } from "./mocks"

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
    GitHubKBConfig,
    JiraConfig,
    ConfluenceConfig,
    PosthogConfig,
    DatadogConfig,
    TimeTriggerConfig,
    LaunchDarklyConfig,
    LinearKBConfig,
    SlackKBConfig,
    TerseConfig,
    WorkOSInputConfig,
    WorkOSKBConfig,
    AttioOutputConfig
} from "./shared/Configs"

export { IntegrationType } from "./shared/Integrations"

export {
    RunHistoryAction,
    RunHistoryStatus,
    RunHistoryTrigger,
    RunHistoryDecision,
    RunHistoryRecord
} from "./shared/RunHistoryTypes"

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


/**
 * CODE GENERATION CODE: This is user specific!!!
 */

// class GithubRepositories {
//     constructor(public readonly repositoryId: number) {}

//     // This is Code-Gened Pre-Compiled step
//     static TerseAI = new GithubRepositories(10030021)
//     static LandingPage = new GithubRepositories(10030022)
// }

// class GithubSkill extends GitHubConfigInternal {
//     constructor(repositories: GithubRepositories[]) {
//         const repositoryIds: number[] = repositories.map(r => r.repositoryId)
//         // Github token is
//         super("github_token", repositoryIds)
//     }
// }

/**
 * CLIENT CODE: What the user will write
 */

// const client = new Terse()

// // This closure will be run according to the trigger configuration in a sandboxed environment.
// const ReleaseNotesJob = client.createJob({
//     name: "Release Notes Job",
//     triggers: [new TimeTrigger("0 0 * * *")],
//     skills: [new GithubSkill([GithubRepositories.TerseAI, GithubRepositories.LandingPage])],
//     onTrigger: async (event: InputEvent, Agent) => {
//         const prompt = "You are a helpful assistant that can help with the release notes"

//         // Run any code here. Can use the toolbox, and our TerseAgent, or they can do whatever they want.
//         const terseAgent = Agent.run(prompt, event)
//     },
//     webhookURL: "https://example.com/webhook"
// })

/**
 * From here, we can test, deploy debug with either CLI and trigger with GithubActions. We can still expose these in WebUI to analyze runs and stuff.
 */
