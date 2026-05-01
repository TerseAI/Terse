import { Agent, AgentInputItem, AgentOutputType, RunResult, RunState, RunStreamEvent, RunToolApprovalItem, StreamedRunResult, Tool } from "@openai/agents"
import type { Session as AgentMemorySession, ModelSettings } from "@openai/agents-core"
import { AiSdkModel } from "@openai/agents-extensions/ai-sdk"
import { ConfigData } from "terse-types"
import { ChangedItem, ModelEvent } from "terse-types"
import { RunHistoryAction } from "terse-types"
import { CompletedEventUsage, CreditGateDeniedError, ModelReference, StripeError } from "terse-types"

import { settings } from "../../config/settings"
import logger from "../../logger"
import type { BillingService } from "../../services/BillingService"
import { Session as AppSession } from "../../types/session"
import { parseModelReference } from "../modelRegistry"
import { transformAgentStreamToModelEvents } from "../streaming"
import { isFailedToolExecutionStatus } from "../toolExecution"

import { RunContext, SystemPromptBuilder, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"

export type SessionWithTracking<T extends AppSession> = T & {
    agent: {
        toolApprovals?: string[]
    }
    runId: string
    agentId: string
}

export abstract class BaseAgentRunner<TSession extends SessionWithTracking<AppSession>, TAgent extends Agent<TSession, AgentOutputType>> {
    private runId: string
    private endedWithToolFailure = false
    protected agent?: TAgent
    protected onRawStreamEvent?: (event: RunStreamEvent) => Promise<void> | void
    // Protect lazy initialization from double-build races when run/resume are called concurrently.
    private buildAgentPromise?: Promise<TAgent>
    private readonly billing?: BillingService

    constructor(params: { runId: string; billing?: BillingService }) {
        this.runId = params.runId
        this.billing = params.billing
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
        const builder = new SystemPromptBuilder<TSession, ConfigData>(params.systemPromptDeps, params.runContext).withStandardSections()
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
        // Base run charges happen at explicit run-start call sites (SDK route, EventProcessor).
        // Still gate every loop entry so unpaid orgs cannot continue on a new turn.
        await this.checkRunGate(settings)
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

        await this.processStream(result, settings)
        return this.buildResult(result)
    }

    async resumeAgent(params: {
        decision: "approve" | "reject"
        stepId: string
        settings: RunExecutionSettings<TSession, TAgent>
        rejectionReason?: string
        responseId?: string
        prepareResumeState?: (state: RunState<TSession, TAgent>) => Promise<void> | void
    }): Promise<AgentRunnerLoopResult<TSession, TAgent>> {
        await this.checkRunGate(params.settings)
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

        const seedResponseId = params.responseId ?? (interruption.rawItem as any)?.providerData?.responseId

        if (params.decision === "approve") {
            // https://github.com/openai/openai-agents-js/pull/1098 Once this gets in, we should support it
            state.approve(interruption)
        } else {
            state.reject(interruption, { message: params.rejectionReason })
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

        const approvalDecision: ApprovalDecision = { decision: params.decision, rejectionReason: params.rejectionReason, responseId: seedResponseId }

        await this.processStream(result, params.settings, { approvalDecision })
        return this.buildResult(result)
    }

    private async processStream(result: StreamedRunResult<TSession, TAgent>, settings: RunExecutionSettings<TSession, TAgent>, options: { approvalDecision?: ApprovalDecision } = {}): Promise<void> {
        const eventStream = transformAgentStreamToModelEvents(result, {
            onToolCallComplete: (callId, toolName, actions) => this.onToolCallComplete(callId, toolName, actions),
            onRawStreamEvent: async streamEvent => {
                await this.recordLLMUsage(settings, streamEvent)
                if (this.onRawStreamEvent) await this.onRawStreamEvent(streamEvent)
            },
            approvalDecision: options.approvalDecision
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
                const responseId = (interruption.rawItem as any)?.providerData?.responseId ?? stepId
                const approvalRequest: ModelEvent = {
                    id: stepId,
                    response_id: responseId,
                    type: "ToolApprovalRequest",
                    timestamp: Date.now(),
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

        return {
            status: "completed",
            result,
            endedWithToolFailure: this.endedWithToolFailure
        }
    }

    private resetRunOutcomeTracking(): void {
        this.endedWithToolFailure = false
    }

    private trackFailedToolCalls(event: ModelEvent): void {
        if (event.type !== "ToolCallComplete") return
        const toolFailed = isFailedToolExecutionStatus(event.status) || Boolean(event.errorContext)
        this.endedWithToolFailure = toolFailed
    }

    private async *trackEventStream(eventStream: AsyncGenerator<ModelEvent, void, unknown>): AsyncGenerator<ModelEvent, void, unknown> {
        for await (const event of eventStream) {
            this.trackFailedToolCalls(event)
            yield event
        }
    }

    private requireAgent(): TAgent {
        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before running the loop.")
        }
        return this.agent
    }

    async checkRunGate(settings: RunExecutionSettings<TSession, TAgent>): Promise<void> {
        if (!this.billing) return

        const orgId = settings.context.user.organizationId
        const gateDecision = await this.billing.checkRunGate({ organizationId: orgId })
        if (!gateDecision.allow) {
            throw new CreditGateDeniedError(gateDecision.reason)
        }
    }

    private getModel(): ModelReference {
        const defaultModel = settings.aisdk.default
        if (!defaultModel) {
            throw new Error("Default model not set")
        }
        const resolved = parseModelReference(defaultModel)
        return resolved
    }

    private recordLLMUsage = async (settings: RunExecutionSettings<TSession, TAgent>, event: RunStreamEvent): Promise<void> => {
        if (event.type !== "raw_model_stream_event") return

        const data = (event as any).data
        const completedEvent = data.type === "response_done" ? data : null
        if (!completedEvent) return

        const usage = normalizeCompletedEventUsage(completedEvent.response?.usage)
        if (!usage) {
            logger.warn("BaseAgentRunner: No usage found for completed event", { event })
            return
        }

        const responseId = completedEvent.response?.id
        if (!responseId) {
            logger.warn("BaseAgentRunner: No response ID found for completed event", { event })
            return
        }

        if (!this.billing) return

        try {
            await this.billing.recordLLMCall({
                organizationId: settings.context.user.organizationId,
                runId: settings.context.runId,
                responseId,
                model: this.getModel(),
                usage
            })
        } catch (error) {
            if (error instanceof StripeError) {
                logger.error("BaseAgentRunner: billing provider error; failing run", { runId: settings.context.runId, error })
            } else {
                logger.error("BaseAgentRunner: unexpected charge failure", { runId: settings.context.runId, error })
            }
            throw error
        }
    }
}

function normalizeCompletedEventUsage(raw: unknown): CompletedEventUsage | null {
    if (!raw || typeof raw !== "object") return null
    const usage = raw as Record<string, unknown>
    const inputTokens = numberValue(usage.inputTokens ?? usage.input_tokens)
    const outputTokens = numberValue(usage.outputTokens ?? usage.output_tokens)
    const totalTokens = numberValue(usage.totalTokens ?? usage.total_tokens)
    if (inputTokens == null || outputTokens == null || totalTokens == null) return null

    const inputDetails = (usage.inputTokensDetails ?? usage.input_tokens_details) as Record<string, unknown> | undefined
    const cachedTokens = numberValue(inputDetails?.cached_tokens ?? inputDetails?.cachedTokens) ?? 0

    return {
        inputTokens,
        outputTokens,
        totalTokens,
        inputTokensDetails: {
            cached_tokens: cachedTokens
        }
    }
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null
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
    systemPromptDeps: SystemPromptBuilderDependencies<TSession, ConfigData>
    runContext: RunContext
    model: AiSdkModel
    tools: Tool<TSession>[]
    modelSettings?: ModelSettings
}

export type ApprovalDecision = {
    decision: "approve" | "reject"
    rejectionReason?: string
    responseId: string
}
