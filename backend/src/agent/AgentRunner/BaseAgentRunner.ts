import { Agent, AgentInputItem, AgentOutputType, RunResult, RunState, RunToolApprovalItem, StreamedRunResult, Tool } from "@openai/agents"
import type { Session as AgentMemorySession, ModelSettings } from "@openai/agents-core"

import logger from "../../logger"
import { Output } from "../../outputs/abstract/Output"
import { ConfigInstance } from "../../shared/Configs"
import { ChangedItem, ModelEvent } from "../../shared/ModelEvents"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { Session as AppSession } from "../../types/session"
import type { StreamEventIngestionSession } from "../CustomMemorySession"
import { createNaturalStopEvent, transformAgentStreamToModelEvents } from "../streaming"
import { isFailedToolExecutionStatus } from "../toolExecution"

import { RunContext, SystemPromptBuilder, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"

export type SessionWithTracking<T extends AppSession> = T & {
    agent: {
        requireApproval: boolean
        toolApprovals?: string[]
    }
    runId: string
    agentId: string
}

export abstract class BaseAgentRunner<TSession extends SessionWithTracking<AppSession>, TAgent extends Agent<TSession, AgentOutputType>> {
    private runId: string
    private toolToIntegrationMap?: Map<string, string>
    private endedWithToolFailure = false
    private agent?: TAgent
    // Protect lazy initialization from double-build races when run/resume are called concurrently.
    private buildAgentPromise?: Promise<TAgent>

    constructor(params: { runId: string; toolToIntegrationMap?: Map<string, string> }) {
        this.runId = params.runId
        this.toolToIntegrationMap = params.toolToIntegrationMap
    }

    protected static buildToolToIntegrationMap<TConfig extends ConfigInstance>(outputs: Output<TConfig>[]): Map<string, string> {
        const map = new Map<string, string>()
        for (const output of outputs) {
            for (const entry of output.toolbox) {
                map.set(entry.tool.name, entry.integration)
            }
        }
        return map
    }

    protected abstract onModelEvent(event: ModelEvent, timestamp: number): Promise<void>
    protected abstract onToolCallComplete(callId: string, toolName: string, actions?: RunHistoryAction[]): Promise<ChangedItem[]>
    protected abstract onApprovalRequest(params: { runId: string; stepId: string; name: string; arguments: string; interruption: RunToolApprovalItem }): Promise<void>
    protected abstract savePendingApprovalState(runId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void>
    protected abstract loadPendingApprovalState(runId: string): Promise<PendingApprovalState | null>
    protected abstract clearPendingApprovalState(runId: string): Promise<void>
    protected abstract markRunInProgress(runId: string): Promise<void>
    protected abstract getAgentInitializationParams(): AgentInitializationParams<TSession>

    protected async initializeLoopIfNeeded(): Promise<void> {
        if (this.agent) return
        if (!this.buildAgentPromise) {
            this.buildAgentPromise = this.buildAgent(this.getAgentInitializationParams()).finally(() => {
                this.buildAgentPromise = undefined
            })
        }
        await this.buildAgentPromise
    }

    async buildAgent(params: AgentInitializationParams<TSession>): Promise<TAgent> {
        const builder = new SystemPromptBuilder<TSession, ConfigInstance>(params.systemPromptDeps, params.runContext).withStandardSections()
        const instructions = await builder.build()
        this.agent = new Agent<TSession, AgentOutputType>({
            name: params.name,
            instructions,
            model: params.model,
            tools: params.tools,
            modelSettings: params.modelSettings
        }) as TAgent
        return this.agent
    }

    async runAgent(userHistory: AgentInputItem[], settings: RunExecutionSettings<TSession, TAgent>): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        await this.initializeLoopIfNeeded()
        this.resetRunOutcomeTracking()
        const result = await settings.runner.run(this.requireAgent(), userHistory, {
            context: settings.context,
            stream: true,
            session: settings.memorySession,
            sessionInputCallback: settings.sessionInputCallback,
            maxTurns: settings.maxTurns,
            signal: settings.signal
        })

        await this.processStream(result, settings.memorySession)
        return this.buildResult(result)
    }

    async resumeAgent(params: {
        decision: "approve" | "reject"
        stepId: string
        settings: RunExecutionSettings<TSession, TAgent>
        onRejected?: (state: RunState<TSession, TAgent>, interruption: RunToolApprovalItem) => Promise<void>
        prepareResumeState?: (state: RunState<TSession, TAgent>) => Promise<void> | void
    }): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        await this.initializeLoopIfNeeded()
        this.resetRunOutcomeTracking()
        const pendingState = await this.loadPendingApprovalState(this.runId)
        if (!pendingState) {
            throw new Error(`No pending approval state found for run ${this.runId}`)
        }
        if (!pendingState.serializedState || typeof pendingState.serializedState !== "string") {
            throw new Error(`Invalid serialized state format for run ${this.runId}. Expected string, got ${typeof pendingState.serializedState}`)
        }

        const agent = this.requireAgent()
        const state = await RunState.fromString<TSession, TAgent>(agent, pendingState.serializedState)
        const interruption = pendingState.interruptions.find(interruptionItem => (interruptionItem.rawItem as any)?.callId === params.stepId)
        if (!interruption) {
            throw new Error(`Could not find matching interruption for step_id ${params.stepId}`)
        }

        if (params.decision === "approve") {
            state.approve(interruption)
        } else {
            state.reject(interruption)
            await params.onRejected?.(state, interruption)
        }

        await this.markRunInProgress(this.runId)
        await this.clearPendingApprovalState(this.runId)
        await params.prepareResumeState?.(state)

        const result = await params.settings.runner.run(agent, state, {
            context: params.settings.context,
            stream: true,
            session: params.settings.memorySession,
            sessionInputCallback: params.settings.sessionInputCallback,
            maxTurns: params.settings.maxTurns,
            signal: params.settings.signal
        })

        await this.processStream(result, params.settings.memorySession)
        return this.buildResult(result)
    }

    private async processStream(result: StreamedRunResult<TSession, TAgent>, memorySession: AgentMemorySession): Promise<void> {
        const streamIngestionSession = asStreamEventIngestionSession(memorySession)
        const eventStream = transformAgentStreamToModelEvents(result, {
            toolToIntegrationMap: this.toolToIntegrationMap,
            onToolCallComplete: (callId, toolName, actions) => this.onToolCallComplete(callId, toolName, actions),
            onRawStreamEvent: async streamEvent => {
                if (!streamIngestionSession) return
                await streamIngestionSession.ingestStreamEvent(streamEvent)
            }
        })

        for await (const event of this.trackEventStream(eventStream)) {
            await this.onModelEvent(event, Date.now())
        }
    }

    private async buildResult(result: StreamedRunResult<TSession, TAgent>): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        const hasInterruptions = result.interruptions && result.interruptions.length > 0
        if (hasInterruptions) {
            const serializedState = JSON.stringify(result.state)
            await this.savePendingApprovalState(this.runId, serializedState, result.interruptions)

            for (const interruption of result.interruptions) {
                const stepId = (interruption.rawItem as any)?.callId
                if (!stepId) {
                    logger.warn("Skipping approval request event because interruption has no callId", {
                        runId: this.runId,
                        toolName: interruption.name
                    })
                    continue
                }
                const approvalRequest: ModelEvent = {
                    type: "ToolApprovalRequest",
                    step_id: stepId,
                    name: interruption.name ?? "unknown_tool",
                    arguments: interruption.arguments ?? "{}"
                }
                await this.onModelEvent(approvalRequest, Date.now())
                await this.onApprovalRequest({
                    runId: this.runId,
                    stepId,
                    name: interruption.name ?? "unknown_tool",
                    arguments: interruption.arguments ?? "{}",
                    interruption
                })
            }

            return {
                status: "awaiting_approval",
                state: result.state,
                interruptions: result.interruptions
            }
        }

        await this.clearPendingApprovalState(this.runId)
        await this.onModelEvent(createNaturalStopEvent(), Date.now())

        return {
            status: "completed",
            result,
            endedWithToolFailure: this.endedWithToolFailure
        }
    }

    private resetRunOutcomeTracking(): void {
        this.endedWithToolFailure = false
    }

    private observeModelEvent(event: ModelEvent): void {
        if (event.type !== "ToolCallComplete") return
        const toolFailed = isFailedToolExecutionStatus(event.status) || Boolean(event.errorContext)
        this.endedWithToolFailure = toolFailed
    }

    private async *trackEventStream(eventStream: AsyncGenerator<ModelEvent, void, unknown>): AsyncGenerator<ModelEvent, void, unknown> {
        for await (const event of eventStream) {
            this.observeModelEvent(event)
            yield event
        }
    }

    private requireAgent(): TAgent {
        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before running the loop.")
        }
        return this.agent
    }
}

function asStreamEventIngestionSession(memorySession: AgentMemorySession): StreamEventIngestionSession | null {
    const candidate = memorySession as unknown as StreamEventIngestionSession
    if (typeof candidate?.ingestStreamEvent !== "function") {
        return null
    }
    return candidate
}

type SessionInputCallback = (history: AgentInputItem[], newItems: AgentInputItem[]) => AgentInputItem[]

type LoopRunner<TSession, TAgent extends Agent<TSession, AgentOutputType>> = {
    run: (
        agent: TAgent,
        input: AgentInputItem[] | RunState<TSession, TAgent>,
        options: {
            context: TSession
            stream: true
            session: AgentMemorySession
            sessionInputCallback?: SessionInputCallback
            maxTurns: number
            signal?: AbortSignal
        }
    ) => Promise<StreamedRunResult<TSession, TAgent>>
}

export type PendingApprovalState = {
    serializedState: string
    interruptions: RunToolApprovalItem[]
}

export type AgentRunnerLoopResult<TSession extends SessionWithTracking<AppSession>, TAgent extends Agent<TSession, AgentOutputType>> =
    | { status: "completed"; result: RunResult<TSession, TAgent>; endedWithToolFailure: boolean }
    | { status: "awaiting_approval"; state: RunState<TSession, TAgent>; interruptions: RunToolApprovalItem[] }

type RunExecutionSettings<TSession extends SessionWithTracking<AppSession>, TAgent extends Agent<TSession, AgentOutputType>> = {
    runner: LoopRunner<TSession, TAgent>
    context: TSession
    memorySession: AgentMemorySession
    sessionInputCallback?: SessionInputCallback
    maxTurns: number
    signal?: AbortSignal
}

type AgentInitializationParams<TSession extends AppSession> = {
    name: string
    systemPromptDeps: SystemPromptBuilderDependencies<TSession, ConfigInstance>
    runContext: RunContext
    model: string
    tools: Tool<TSession>[]
    modelSettings?: ModelSettings
}
