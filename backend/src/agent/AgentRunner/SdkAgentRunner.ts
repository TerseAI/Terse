import { Agent, AgentInputItem, AgentOutputType, RunResult, RunToolApprovalItem, Tool } from "@openai/agents"
import type { Session as AgentMemorySession, ModelSettings } from "@openai/agents-core"
import { OutputConfigType } from "@prisma/client"

import { settings } from "../../config/settings"
import { Output } from "../../outputs/abstract/Output"
import { OutputFactory } from "../../outputs/abstract/OutputFactory"
import { CONFIG_DETAILS, ConfigInstance } from "../../shared/Configs"
import { ChangedItem, ModelEvent, ToolCallExecutionStatus } from "../../shared/ModelEvents"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { SdkAgentSkillPayload, SdkAgentStreamEvent, User } from "../../shared/types"
import { Session } from "../../types/session"
import { convertConfigTypeToOutputConfigType, convertPlainObjectToConfigInstance } from "../../utility/typeConverters"
import { AgentType, runnerFactory } from "../runner"

import { AgentRunnerLoopResult, BaseAgentRunner, PendingApprovalState, SessionWithTracking } from "./BaseAgentRunner"
import { BaseSystemPromptBuilder, RunContext, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"

type SdkRunnerSession = SessionWithTracking<Session>

type SdkAgentRunnerParams = {
    runId: string
    user: User
    prompt: string
    skills: SdkAgentSkillPayload[]
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
    private readonly outputs: Output<ConfigInstance>[]
    private readonly tools: Tool<SdkRunnerSession>[]
    private readonly maxTurns: number
    private readonly requireApproval: boolean
    private readonly send: (event: SdkAgentStreamEvent) => void
    private readonly memorySession: AgentMemorySession
    private pendingApprovalState: PendingApprovalState | null = null
    private readonly failedToolCalls: Array<{ tool: string; status: ToolCallExecutionStatus; error?: string }> = []

    constructor(params: SdkAgentRunnerParams) {
        super({
            runId: params.runId,
            toolToIntegrationMap: params.toolToIntegrationMap
        })
        this.sdkRunId = params.runId
        this.user = params.user
        this.prompt = params.prompt
        const skillConfigs = params.skills.map(skill => convertPlainObjectToConfigInstance(skill.config))
        this.outputs = this.buildOutputsFromConfigs(skillConfigs)
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
            if (event.status !== ToolCallExecutionStatus.COMPLETED) {
                this.failedToolCalls.push({
                    tool: event.tool_name,
                    status: event.status,
                    error: event.errorContext ? String(event.errorContext.error) : undefined
                })
            }
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
        modelSettings?: ModelSettings
    }): Promise<Agent<SdkRunnerSession, AgentOutputType>> {
        const instructions = await new BaseSystemPromptBuilder<SdkRunnerSession, ConfigInstance>(_params.systemPromptDeps, _params.runContext)
            .withStandardSections()
            .withSection(() => ({
                header: "SDK USER INSTRUCTIONS",
                content: this.prompt
            }))
            .build()

        this.agent = new Agent<SdkRunnerSession, AgentOutputType>({
            name: _params.name,
            model: _params.model,
            instructions,
            tools: _params.tools,
            modelSettings: _params.modelSettings
        })
        return this.agent
    }

    protected getAgentInitializationParams() {
        const deps: SystemPromptBuilderDependencies<SdkRunnerSession, ConfigInstance> = {
            session: this.getToolContext(),
            agent: {
                id: "sdk-agent-run",
                user_id: this.user.id
            },
            outputs: this.outputs
        }

        return {
            name: "Terse SDK Agent",
            systemPromptDeps: deps,
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

    hasToolFailures(): boolean {
        return this.failedToolCalls.length > 0
    }

    getToolFailureSummary(maxItems: number = 3): string {
        if (this.failedToolCalls.length === 0) return "One or more tool calls failed."
        const summarized = this.failedToolCalls.slice(0, maxItems).map(failure => {
            const detail = failure.error ? ` (${failure.error})` : ""
            return `${failure.tool}: ${failure.status}${detail}`
        })
        const remaining = this.failedToolCalls.length - summarized.length
        const suffix = remaining > 0 ? ` (+${remaining} more)` : ""
        return `Tool call failures: ${summarized.join("; ")}${suffix}`
    }

    private buildOutputsFromConfigs(configs: ConfigInstance[]): Output<ConfigInstance>[] {
        const grouped = new Map<OutputConfigType, ConfigInstance[]>()
        for (const config of configs) {
            const details = CONFIG_DETAILS[config.configType]
            if (!details.isOutput) continue
            const outputType = convertConfigTypeToOutputConfigType(config.configType)
            const existing = grouped.get(outputType) ?? []
            existing.push(config)
            grouped.set(outputType, existing)
        }

        const outputs: Output<ConfigInstance>[] = []
        for (const [outputType, configs] of grouped.entries()) {
            const output = OutputFactory.createOutput(outputType)
            if (!output) continue
            outputs.push(output)
        }
        return outputs
    }
}
