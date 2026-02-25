import { Agent, AgentInputItem, AgentOutputType, RunResult, RunState, RunToolApprovalItem, StreamedRunResult, Tool } from "@openai/agents"
import type { Session as AgentMemorySession, ModelSettings, RunStreamEvent } from "@openai/agents-core"

import logger from "../../logger"
import { ChangedItem, ModelEvent } from "../../shared/ModelEvents"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { Session as AppSession } from "../../types/session"
import { createNaturalStopEvent, transformAgentStreamToModelEvents } from "../streaming"
import { isFailedToolExecutionStatus } from "../toolExecution"

import type { SessionWithTracking } from "./AgentRunner"

export class AgentRunnerLoopCore<TSession extends SessionWithTracking<AppSession>, TAgent extends Agent<TSession, AgentOutputType>> {
    private runId: string
    private callbacks: AgentRunnerLoopCallbacks
    private toolToIntegrationMap?: Map<string, string>
    private endedWithToolFailure = false
    private agent?: TAgent

    constructor(params: { runId: string; callbacks: AgentRunnerLoopCallbacks; toolToIntegrationMap?: Map<string, string> }) {
        this.runId = params.runId
        this.callbacks = params.callbacks
        this.toolToIntegrationMap = params.toolToIntegrationMap
    }

    initializeAgent(params: AgentInitializationParams<TSession>): TAgent {
        this.agent = new Agent<TSession, AgentOutputType>({
            name: params.name,
            instructions: params.instructions,
            model: params.model,
            tools: params.tools,
            modelSettings: params.modelSettings
        }) as TAgent
        return this.agent
    }

    async runUserHistory(userHistory: AgentInputItem[], settings: RunExecutionSettings<TSession, TAgent>): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        this.resetRunOutcomeTracking()
        const result = await settings.runner.run(this.requireAgent(), userHistory, {
            context: settings.context,
            stream: true,
            session: settings.memorySession,
            sessionInputCallback: settings.sessionInputCallback,
            maxTurns: settings.maxTurns
        })

        await this.processStream(result)
        return this.buildResult(result)
    }

    async resumeFromPendingApproval(params: {
        decision: "approve" | "reject"
        stepId: string
        settings: RunExecutionSettings<TSession, TAgent>
        onRejected?: (state: RunState<TSession, TAgent>, interruption: RunToolApprovalItem) => Promise<void>
        prepareResumeState?: (state: RunState<TSession, TAgent>) => Promise<void> | void
    }): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        this.resetRunOutcomeTracking()
        const pendingState = await this.callbacks.loadPendingApprovalState(this.runId)
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

        await this.callbacks.markRunInProgress(this.runId)
        await this.callbacks.clearPendingApprovalState(this.runId)
        await params.prepareResumeState?.(state)

        const result = await params.settings.runner.run(agent, state, {
            context: params.settings.context,
            stream: true,
            session: params.settings.memorySession,
            sessionInputCallback: params.settings.sessionInputCallback,
            maxTurns: params.settings.maxTurns
        })

        await this.processStream(result)
        return this.buildResult(result)
    }

    private async processStream(result: StreamedRunResult<TSession, TAgent>): Promise<void> {
        if (!this.callbacks.onModelEvent) {
            await this.processWithLogging(result)
            return
        }

        const eventStream = transformAgentStreamToModelEvents(result, {
            toolToIntegrationMap: this.toolToIntegrationMap,
            onToolCallComplete: (callId, toolName, actions) => {
                return this.callbacks.onToolCallComplete ? this.callbacks.onToolCallComplete(callId, toolName, actions) : Promise.resolve([])
            }
        })

        for await (const event of this.trackEventStream(eventStream)) {
            await this.callbacks.onModelEvent(event, Date.now())
        }
    }

    private async processWithLogging(result: StreamedRunResult<TSession, TAgent>): Promise<void> {
        for await (const event of result as AsyncIterable<RunStreamEvent>) {
            if (event.type === "raw_model_stream_event") {
                logger.info(event.type, { data: event.data })
            } else if (event.type === "agent_updated_stream_event") {
                logger.info(event.type, { agentName: event.agent.name })
            } else if (event.type === "run_item_stream_event") {
                logger.info(event.type, { item: event.item })
            }
        }
    }

    private async buildResult(result: StreamedRunResult<TSession, TAgent>): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        const hasInterruptions = result.interruptions && result.interruptions.length > 0
        if (hasInterruptions) {
            const serializedState = JSON.stringify(result.state)
            await this.callbacks.savePendingApprovalState(this.runId, serializedState, result.interruptions)

            if (this.callbacks.onModelEvent) {
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
                    await this.callbacks.onModelEvent(approvalRequest, Date.now())
                    await this.callbacks.onApprovalRequest?.({
                        runId: this.runId,
                        stepId,
                        name: interruption.name ?? "unknown_tool",
                        arguments: interruption.arguments ?? "{}",
                        interruption
                    })
                }
            }

            return {
                status: "awaiting_approval",
                state: result.state,
                interruptions: result.interruptions
            }
        }

        await this.callbacks.clearPendingApprovalState(this.runId)
        if (this.callbacks.onModelEvent) {
            await this.callbacks.onModelEvent(createNaturalStopEvent(), Date.now())
        }

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

type SessionInputCallback = (history: AgentInputItem[], newItems: AgentInputItem[]) => AgentInputItem[]

type LoopRunner<TSession, TAgent extends Agent<TSession, any>> = {
    run: (
        agent: TAgent,
        input: AgentInputItem[] | RunState<TSession, TAgent>,
        options: {
            context: TSession
            stream: true
            session: AgentMemorySession
            sessionInputCallback?: SessionInputCallback
            maxTurns: number
        }
    ) => Promise<StreamedRunResult<TSession, TAgent>>
}

export type PendingApprovalState = {
    serializedState: string
    interruptions: RunToolApprovalItem[]
}

export type AgentRunnerLoopCallbacks = {
    onModelEvent?: (event: ModelEvent, timestamp: number) => Promise<void>
    onToolCallComplete?: (callId: string, toolName: string, actions?: RunHistoryAction[]) => Promise<ChangedItem[]>
    onApprovalRequest?: (params: { runId: string; stepId: string; name: string; arguments: string; interruption: RunToolApprovalItem }) => Promise<void>
    savePendingApprovalState: (runId: string, serializedState: string, interruptions: RunToolApprovalItem[]) => Promise<void>
    loadPendingApprovalState: (runId: string) => Promise<PendingApprovalState | null>
    clearPendingApprovalState: (runId: string) => Promise<void>
    markRunInProgress: (runId: string) => Promise<void>
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
}

type AgentInitializationParams<TSession> = {
    name: string
    instructions: string
    model: string
    tools: Tool<TSession>[]
    modelSettings?: ModelSettings
}
