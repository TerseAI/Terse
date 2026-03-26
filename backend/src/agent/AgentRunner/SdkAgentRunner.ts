import { Agent, AgentInputItem, AgentOutputType, RunResult, RunToolApprovalItem, Tool } from "@openai/agents"
import type { Session as AgentMemorySession, ModelSettings } from "@openai/agents-core"
import { OutputConfigType, RunHistoryActionType } from "@prisma/client"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { NotificationManager } from "../../notifications/Notification"
import { Output } from "../../outputs/abstract/Output"
import { OutputFactory } from "../../outputs/abstract/OutputFactory"
import { db } from "../../prismaClient"
import { emitCacheInvalidationWithWildcard, getSocketIO } from "../../services/CacheInvalidationService"
import { CONFIG_DETAILS, ConfigInstance } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { ChangedItem, ModelEvent, ToolCallExecutionStatus } from "../../shared/ModelEvents"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { SdkAgentSkillPayload, SdkAgentStreamEvent, User } from "../../shared/types"
import { Session } from "../../types/session"
import { convertConfigTypeToOutputConfigType, convertPlainObjectToConfigInstance } from "../../utility/typeConverters"
import { RunHistoryChatMemorySession, recentHistoryCallback } from "../CustomMemorySession"
import { AgentType, runnerFactory } from "../runner"
import { appendToolApprovalRequestSystemEvent } from "../systemEvents/toolApprovalSystemEvent"
import { buildUserMessage } from "../userMessage"

import { AgentRunnerLoopResult, BaseAgentRunner, PendingApprovalState, SessionWithTracking } from "./BaseAgentRunner"
import { StreamEventEmitter } from "./StreamProcessor"
import { BaseSystemPromptBuilder, RunContext, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"
import { clearPendingApprovalState as clearPendingApprovalStateDb, markRunInProgress as markRunInProgressDb, storePendingApprovalState } from "./runHistory"

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
    isProductionRun?: boolean
}

type SdkAgentRunnerResult = {
    loopResult: AgentRunnerLoopResult<SdkRunnerSession, Agent<SdkRunnerSession, AgentOutputType>>
}

const SDK_AGENT_ID = "sdk-agent-run"

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
    private readonly isProductionRun: boolean
    private readonly streamEventEmitter: StreamEventEmitter
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
        this.isProductionRun = !!params.isProductionRun
        this.memorySession = params.isProductionRun ? new RunHistoryChatMemorySession({ sessionId: params.runId }) : new InMemoryAgentSession(params.runId)
        this.streamEventEmitter = new StreamEventEmitter(getSocketIO(), {
            runId: params.runId,
            agentId: SDK_AGENT_ID,
            user: params.user
        })
    }

    private createRunner() {
        return runnerFactory({
            agentId: SDK_AGENT_ID,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.sdkRunId,
            user: this.user,
            env: settings.nodeEnv
        })
    }

    async run(eventText: string): Promise<SdkAgentRunnerResult> {
        const loopResult = await super.runAgent(
            [
                {
                    role: "user",
                    content: eventText
                }
            ],
            {
                runner: this.createRunner(),
                context: this.getToolContext(),
                memorySession: this.memorySession,
                sessionInputCallback: recentHistoryCallback,
                maxTurns: this.maxTurns
            }
        )
        return { loopResult }
    }

    async resume(
        decision: "approve" | "reject",
        stepId: string,
        serializedState: string,
        interruptions: RunToolApprovalItem[],
        rejectionReason?: string,
        editedArguments?: string
    ): Promise<SdkAgentRunnerResult> {
        this.pendingApprovalState = { serializedState, interruptions }

        const loopResult = await super.resumeAgent({
            decision,
            stepId,
            rejectionReason,
            editedArguments,
            settings: {
                runner: this.createRunner(),
                context: this.getToolContext(),
                memorySession: this.memorySession,
                sessionInputCallback: recentHistoryCallback,
                maxTurns: this.maxTurns
            }
        })
        return { loopResult }
    }

    protected async onModelEvent(event: ModelEvent, timestamp: number): Promise<void> {
        this.streamEventEmitter.emit(event, timestamp)
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
            return
        }
        if (event.type === "ToolApprovalRequest") {
            this.send({
                type: "tool_approval_requested",
                toolApprovalRequested: {
                    stepId: event.step_id,
                    toolName: event.name,
                    arguments: event.arguments
                }
            })
        }
    }

    protected async onToolCallComplete(_callId: string, _toolName: string, actions?: RunHistoryAction[]): Promise<ChangedItem[]> {
        for (const action of actions ?? []) {
            this.send({ type: "action", action })
        }
        return []
    }

    protected async onApprovalRequest(params: { runId: string; stepId: string; name: string; arguments: string; interruption: RunToolApprovalItem }): Promise<void> {
        if (!this.isProductionRun) return

        const { runId, stepId, name, arguments: toolArgs } = params

        // Load automation for notifications
        const prisma = db()
        const runRecord = await prisma.run_history_records.findUnique({
            where: { id: runId },
            include: { automation: true }
        })
        if (!runRecord?.automation) {
            logger.warn("[SdkAgentRunner] No automation found for approval notification", { runId })
            return
        }

        const automation = runRecord.automation

        // Emit cache invalidation
        if (automation.organization_id) {
            emitCacheInvalidationWithWildcard(automation.organization_id, "runHistory", automation.id)
            emitCacheInvalidationWithWildcard(automation.organization_id, "chatHistory", runId)
        }

        // Persist system event
        try {
            await appendToolApprovalRequestSystemEvent(runId, { step_id: stepId, name, arguments: toolArgs })
        } catch (error) {
            logger.warn("[SdkAgentRunner] Failed to append tool approval system event", { runId, stepId, error })
        }

        // Send notification
        try {
            const integration = (this.toolToIntegrationMap?.get(name) as IntegrationType) ?? IntegrationType.TERSE
            const approvalAction: RunHistoryAction = {
                action: `Approval requested for ${name}`,
                integration,
                target: name,
                details: `The bot is requesting approval to execute: ${name} with arguments: ${JSON.stringify(toolArgs)}`,
                step_id: stepId,
                type: RunHistoryActionType.update,
                isReadOnly: false
            }
            await new NotificationManager(this.user, automation).notifyApprovalRequest(runId, approvalAction)
        } catch (error) {
            logger.error("[SdkAgentRunner] Failed to send approval request notification", { error, runId, stepId })
        }
    }

    protected async savePendingApprovalState(runId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void> {
        this.pendingApprovalState = { serializedState, interruptions }
        if (this.isProductionRun) {
            await storePendingApprovalState(runId, serializedState, interruptions)
        }
    }

    protected async loadPendingApprovalState(_runId: string): Promise<PendingApprovalState | null> {
        return this.pendingApprovalState
    }

    protected async clearPendingApprovalState(runId: string): Promise<void> {
        this.pendingApprovalState = null
        if (this.isProductionRun) {
            await clearPendingApprovalStateDb(runId)
        }
    }

    protected async markRunInProgress(runId: string): Promise<void> {
        if (this.isProductionRun) {
            await markRunInProgressDb(runId)
        }
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
                id: SDK_AGENT_ID,
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
                requireApproval: this.requireApproval
            },
            runId: this.sdkRunId,
            agentId: SDK_AGENT_ID
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
            output.configs = configs
            outputs.push(output)
        }

        return outputs
    }
}
