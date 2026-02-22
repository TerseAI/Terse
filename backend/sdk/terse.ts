import { InputEvent } from "../src/integrations/abstract/InputEvent"
import { ToolboxEntry } from "../src/outputs/abstract/Output"
import { ConfigInstance, GitHubConfig as GitHubConfigInternal, TimeTriggerConfig as TimeTrigger } from "../src/shared/Configs"
import { RunHistoryAction as TerseRunHistoryAction } from "../src/shared/RunHistoryTypes"

/**
 * SDK CODE
 */

type ToolBox = ToolboxEntry[]
type Action = TerseRunHistoryAction

type CreateJobParameters = {
    name: string
    triggers: ConfigInstance[]
    skills: ConfigInstance[]
    filterConfiguration?: FilterConfiguration[]
    onTrigger: (event: InputEvent, Agent: TerseAgent) => Promise<void>
    webhookURL: string
}
class Terse {
    constructor() {
        // fetch api_key from env
    }

    createJob(params: CreateJobParameters) {
        // Deploy the job, run code in Modal Sandbox etc...
        // This is most of the work tbh
    }
}

type FilterConfiguration = {
    criteria: string
}

// A good chunk of work here too. I am hoping it's a simpler version of AgentRunner
class TerseAgent {
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

enum EventType {
    TEXT = "text",
    TOOL_CALL_PARAMS = "tool_call_params",
    TOOL_CALL_STARTED = "tool_call_started",
    TOOL_CALL_COMPLETED = "tool_call_completed",
    ACTION = "action"
}
interface TerseAgentResult {
    type: EventType
}

class TextResult implements TerseAgentResult {
    type: EventType.TEXT
    text: string

    constructor(text: string) {
        this.type = EventType.TEXT
        this.text = text
    }
}

class ToolCallParamsResult implements TerseAgentResult {
    type: EventType.TOOL_CALL_PARAMS
    toolCallParams: string

    constructor(toolCallParams: string) {
        this.type = EventType.TOOL_CALL_PARAMS
        this.toolCallParams = toolCallParams
    }
}

class ToolCallStartedResult implements TerseAgentResult {
    type: EventType.TOOL_CALL_STARTED
    toolCallStarted: string

    constructor(toolCallStarted: string) {
        this.type = EventType.TOOL_CALL_STARTED
        this.toolCallStarted = toolCallStarted
    }
}

class ToolCallCompletedResult implements TerseAgentResult {
    type: EventType.TOOL_CALL_COMPLETED
    toolCallCompleted: string

    constructor(toolCallCompleted: string) {
        this.type = EventType.TOOL_CALL_COMPLETED
        this.toolCallCompleted = toolCallCompleted
    }
}

class ActionResult implements TerseAgentResult {
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

class GithubRepositories {
    constructor(public readonly repositoryId: number) {}

    // This is Code-Gened Pre-Compiled step
    static TerseAI = new GithubRepositories(10030021)
    static LandingPage = new GithubRepositories(10030022)
}

class GithubSkill extends GitHubConfigInternal {
    constructor(repositories: GithubRepositories[]) {
        const repositoryIds: number[] = repositories.map(r => r.repositoryId)
        // Github token is
        super("github_token", repositoryIds)
    }
}

/**
 * CLIENT CODE: What the user will write
 */

const client = new Terse()

// This closure will be run according to the trigger configuration in a sandboxed environment.
const ReleaseNotesJob = client.createJob({
    name: "Release Notes Job",
    triggers: [new TimeTrigger("0 0 * * *")],
    skills: [new GithubSkill([GithubRepositories.TerseAI, GithubRepositories.LandingPage])],
    onTrigger: async (event: InputEvent, Agent) => {
        const prompt = "You are a helpful assistant that can help with the release notes"

        // Run any code here. Can use the toolbox, and our TerseAgent, or they can do whatever they want.
        const terseAgent = Agent.run(prompt, event)
    },
    webhookURL: "https://example.com/webhook"
})

/**
 * From here, we can test, deploy debug with either CLI and trigger with GithubActions. We can still expose these in WebUI to analyze runs and stuff.
 */
