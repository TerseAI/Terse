import { Agent, AgentInputItem, AgentOutputType, RunResult, RunToolApprovalItem, Tool } from "@openai/agents"
import type { Session as AgentMemorySession } from "@openai/agents-core"

import { settings } from "../../config/settings"
import { ConfigInstance } from "../../shared/Configs"
import { ChangedItem, ModelEvent } from "../../shared/ModelEvents"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { SdkAgentStreamEvent, User } from "../../shared/types"
import { Session } from "../../types/session"
import { AgentType, runnerFactory } from "../runner"

import { AgentRunnerLoopResult, BaseAgentRunner, PendingApprovalState, SessionWithTracking } from "./BaseAgentRunner"
import { RunContext, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"

type SdkRunnerSession = SessionWithTracking<Session>

type SdkAgentRunnerParams = {
    runId: string
    user: User
    prompt: string
    tools: Tool<SdkRunnerSession>[]
    toolToIntegrationMap: Map<string, string>
    maxTurns: number
    requireApproval: boolean
    send: (event: SdkAgentStreamEvent) => void
}

type SdkAgentRunnerResult = {
    loopResult: AgentRunnerLoopResult<SdkRunnerSession, Agent<SdkRunnerSession, AgentOutputType>>
}

class InMemoryAgentSession implements AgentMemorySession {
    private readonly sessionId: string
    private items: AgentInputItem[] = []

    constructor(sessionId: string) {
        this.sessionId = sessionId
    }

    async getSessionId(): Promise<string> {
        return this.sessionId
    }

    async getItems(limit?: number): Promise<AgentInputItem[]> {
        if (limit === undefined || limit >= this.items.length) {
            return [...this.items]
        }
        return this.items.slice(-limit)
    }

    async addItems(items: AgentInputItem[]): Promise<void> {
        if (items.length === 0) return
        this.items.push(...items)
    }

    async popItem(): Promise<AgentInputItem | undefined> {
        return this.items.pop()
    }

    async clearSession(): Promise<void> {
        this.items = []
    }
}

export class SdkAgentRunner extends BaseAgentRunner<SdkRunnerSession, Agent<SdkRunnerSession, AgentOutputType>> {
    private readonly sdkRunId: string
    private readonly user: User
    private readonly prompt: string
    private readonly tools: Tool<SdkRunnerSession>[]
    private readonly maxTurns: number
    private readonly requireApproval: boolean
    private readonly send: (event: SdkAgentStreamEvent) => void
    private readonly memorySession: AgentMemorySession
    private pendingApprovalState: PendingApprovalState | null = null

    constructor(params: SdkAgentRunnerParams) {
        super({
            runId: params.runId,
            toolToIntegrationMap: params.toolToIntegrationMap
        })
        this.sdkRunId = params.runId
        this.user = params.user
        this.prompt = params.prompt
        this.tools = params.tools
        this.maxTurns = params.maxTurns
        this.requireApproval = params.requireApproval
        this.send = params.send
        this.memorySession = new InMemoryAgentSession(params.runId)
    }

    async run(eventText: string): Promise<SdkAgentRunnerResult> {
        const runner = runnerFactory({
            agentId: "sdk-agent-run",
            agentType: AgentType.AGENT_RUNNER,
            runId: this.sdkRunId,
            user: this.user,
            env: settings.nodeEnv
        })
        const loopResult = await super.runAgent(
            [
                {
                    role: "user",
                    content: eventText
                }
            ],
            {
                runner,
                context: this.getToolContext(),
                memorySession: this.memorySession,
                maxTurns: this.maxTurns
            }
        )
        return { loopResult }
    }

    protected async onModelEvent(event: ModelEvent, _timestamp: number): Promise<void> {
        if (event.type === "TextDelta" && event.delta) {
            this.send({ type: "text", text: event.delta })
            return
        }
        if (event.type === "ToolCall") {
            this.send({ type: "tool_call_params", toolCallParams: event.parameters })
            this.send({ type: "tool_call_started", toolCallStarted: event.summary })
            return
        }
        if (event.type === "ToolCallComplete") {
            this.send({
                type: "tool_call_completed",
                toolCallCompleted: JSON.stringify({
                    tool: event.tool_name,
                    status: event.status,
                    result: event.result
                })
            })
        }
    }

    protected async onToolCallComplete(_callId: string, _toolName: string, actions?: RunHistoryAction[]): Promise<ChangedItem[]> {
        for (const action of actions ?? []) {
            this.send({ type: "action", action })
        }
        return []
    }

    protected async onApprovalRequest(_params: { runId: string; stepId: string; name: string; arguments: string; interruption: RunToolApprovalItem }): Promise<void> {
        // sdk/agent-run currently streams a one-shot run and does not expose approval resume APIs.
    }

    protected async savePendingApprovalState(_runId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void> {
        this.pendingApprovalState = {
            serializedState,
            interruptions
        }
    }

    protected async loadPendingApprovalState(_runId: string): Promise<PendingApprovalState | null> {
        return this.pendingApprovalState
    }

    protected async clearPendingApprovalState(_runId: string): Promise<void> {
        this.pendingApprovalState = null
    }

    protected async markRunInProgress(_runId: string): Promise<void> {
        return
    }

    override async buildAgent(_params: {
        name: string
        systemPromptDeps: SystemPromptBuilderDependencies<SdkRunnerSession, ConfigInstance>
        runContext: RunContext
        model: string
        tools: Tool<SdkRunnerSession>[]
    }): Promise<Agent<SdkRunnerSession, AgentOutputType>> {
        this.agent = new Agent<SdkRunnerSession, AgentOutputType>({
            name: "Terse SDK Agent",
            model: "gpt-5.2",
            instructions: this.prompt,
            tools: this.tools
        })
        return this.agent
    }

    protected getAgentInitializationParams() {
        return {
            name: "Terse SDK Agent",
            systemPromptDeps: {} as SystemPromptBuilderDependencies<SdkRunnerSession, ConfigInstance>,
            runContext: { runId: this.sdkRunId } as RunContext,
            model: "gpt-5.2",
            tools: this.tools
        }
    }

    private getToolContext(): SdkRunnerSession {
        return {
            user: this.user,
            isUserInitiated: true,
            agent: {
                requireApproval: this.requireApproval,
                toolApprovals: []
            },
            runId: this.sdkRunId,
            agentId: "sdk-agent-run"
        }
    }

    static getFinalOutput(result: RunResult<SdkRunnerSession, Agent<SdkRunnerSession, AgentOutputType>>): string | null {
        if (typeof result.finalOutput !== "string") return null
        const output = result.finalOutput.trim()
        return output || null
    }
}
