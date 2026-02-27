import { Agent, AgentInputItem, AgentOutputType, RunResult, RunState, RunToolApprovalItem, Tool, protocol } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"

import { settings } from "../../config/settings"
import { InputEvent } from "../../integrations/abstract/InputEvent"
import logger from "../../logger"
import { NotificationManager } from "../../notifications/Notification"
import { Output } from "../../outputs/abstract/Output"
import { emitCacheInvalidationWithWildcard, getSocketIO } from "../../services/CacheInvalidationService"
import { FileCategory, StoredFile } from "../../services/FileStorageService"
import { ConfigInstance } from "../../shared/Configs"
import { EntityType } from "../../shared/Entities"
import { IntegrationType } from "../../shared/Integrations"
import { ChangeEventType, ChangedItem, ModelEvent } from "../../shared/ModelEvents"
import type { RunHistoryAction, TrackingParams } from "../../shared/RunHistoryTypes"
import { AgentWithRelations } from "../../types/prisma"
import { Session } from "../../types/session"
import { UserFormatter } from "../../utility/UserFormatter"
import { RunHistoryChatMemorySession, recentHistoryCallback } from "../CustomMemorySession"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"
import { appendToolApprovalRequestSystemEvent } from "../systemEvents/toolApprovalSystemEvent"
import { buildUserMessage, buildUserMessageFromContent } from "../userMessage"

import { AgentRunnerLoopResult, BaseAgentRunner, SessionWithTracking } from "./BaseAgentRunner"
import { persistRunAction } from "./EventProcessor"
import { StreamEventEmitter } from "./StreamProcessor"
import { RunContext, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"
import { buildRunTriggerContextMessage, formatAgentTriggersForAgent } from "./formatContext"
import { persistOutputAttributions, removeOutputAttributions } from "./persistOutputAttributions"
import { clearPendingApprovalState, getPendingApprovalState, markRunInProgress, storePendingApprovalState } from "./runHistory"

// Types from @openai/agents SDK for content items
type AgentInputText = protocol.InputText
type AgentInputImage = protocol.InputImage
type AgentInputFile = protocol.InputFile

type UserMessageContent = AgentInputText | AgentInputImage | AgentInputFile

export class AgentRunner<T extends Session, TConfig extends ConfigInstance> extends BaseAgentRunner<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>> {
    private session: T
    private inputEvent: InputEvent | null = null
    private agentConfig: AgentWithRelations
    private outputs: Output<TConfig>[]
    private tools: Tool<SessionWithTracking<T>>[] = []
    private runContext: RunContext
    private toolMetadataMap: Map<string, ToolMetadata> = new Map()
    private memorySession: RunHistoryChatMemorySession
    private maxTurns: number
    private notificationManager: NotificationManager
    private activeStreamingParams?: TrackingParams

    constructor(session: T, outputs: Output<TConfig>[], agent: AgentWithRelations, runContext: RunContext, maxTurns: number = 50) {
        super({
            runId: runContext.runId,
            toolToIntegrationMap: BaseAgentRunner.buildToolToIntegrationMap(outputs)
        })
        this.session = session
        this.outputs = outputs
        this.agentConfig = agent
        const toolsMap = new Map<string, Tool<SessionWithTracking<T>>>()

        outputs.forEach(output => {
            output.toolbox.forEach(entry => {
                toolsMap.set(entry.tool.name, entry.tool)
            })
        })

        this.tools = Array.from(toolsMap.values())

        this.runContext = runContext
        this.buildToolMetadataMap()
        this.memorySession = new RunHistoryChatMemorySession({
            sessionId: runContext.runId
        })
        if (!maxTurns || maxTurns < 1) {
            throw new Error("Max turns must be greater than 0")
        }
        this.maxTurns = maxTurns
        this.notificationManager = new NotificationManager(session.user, agent)
    }

    async run(
        streamingParams?: TrackingParams,
        options?: { signal?: AbortSignal }
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        if (!this.inputEvent) {
            throw new Error("No input event set. Call setInputEvent() before run()")
        }

        const text = this.buildTextContent(this.inputEvent)
        const userMessage = this.buildUserContent(text, this.inputEvent.getFiles())
        const userHistory: AgentInputItem[] = this.buildUserHistory(userMessage)

        const runner = runnerFactory({
            agentId: this.agentConfig.id,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.runContext.runId,
            user: this.session.user,
            env: settings.nodeEnv
        })

        logger.info("User history build to be sent to agent", { userHistory: JSON.stringify(userHistory, null, 2) })

        this.activeStreamingParams = streamingParams
        let loopResult: AgentRunnerLoopResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>
        try {
            loopResult = await super.runAgent(userHistory, {
                runner,
                context: this.getToolContext(),
                memorySession: this.memorySession,
                sessionInputCallback: recentHistoryCallback,
                maxTurns: this.maxTurns,
                signal: options?.signal
            })
        } finally {
            this.activeStreamingParams = undefined
        }
        return this.mapLoopResult(loopResult)
    }

    async userMessageRun(
        userMessage: string,
        files?: StoredFile[],
        streamingParams?: TrackingParams,
        options?: { signal?: AbortSignal }
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        const content = this.buildUserContent(userMessage, files)
        const userHistory = this.buildUserHistory(content)
        const runner = runnerFactory({
            agentId: this.agentConfig.id,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.runContext.runId,
            user: this.session.user,
            env: settings.nodeEnv
        })
        this.activeStreamingParams = streamingParams
        let loopResult: AgentRunnerLoopResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>
        try {
            loopResult = await super.runAgent(userHistory, {
                runner,
                context: this.getToolContext(),
                memorySession: this.memorySession,
                sessionInputCallback: recentHistoryCallback,
                maxTurns: this.maxTurns,
                signal: options?.signal
            })
        } finally {
            this.activeStreamingParams = undefined
        }
        return this.mapLoopResult(loopResult)
    }

    private buildUserHistory(content: UserMessageContent[]): AgentInputItem[] {
        return [buildUserMessageFromContent(content)]
    }

    async resumeFromPendingApproval(
        decision: Decision,
        stepId: string,
        streamingParams?: TrackingParams,
        rejectionReason?: string,
        hardReject?: boolean,
        options?: { signal?: AbortSignal }
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        logger.info("[ApprovalFlow] Resuming from pending approval", { runId: this.runContext.runId, stepId, decision })

        const runner = runnerFactory({
            agentId: this.agentConfig.id,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.runContext.runId,
            user: this.session.user,
            env: settings.nodeEnv
        })
        const toolContext = this.getToolContext()
        this.activeStreamingParams = streamingParams
        let loopResult: AgentRunnerLoopResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>
        try {
            loopResult = await super.resumeAgent({
                decision,
                stepId,
                settings: {
                    runner,
                    context: toolContext,
                    memorySession: this.memorySession,
                    sessionInputCallback: recentHistoryCallback,
                    maxTurns: this.maxTurns,
                    signal: options?.signal
                },
                onRejected: async (state, interruption) => {
                    const stateWithHistory = state as unknown as { history?: AgentInputItem[] }
                    if (stateWithHistory.history && Array.isArray(stateWithHistory.history)) {
                        if (hardReject) {
                            const hardRejectMessage = buildUserMessage(
                                `A human reviewer rejected your previous tool call "${interruption.name}" and has chosen to stop this workflow entirely.\n\n` +
                                    `Do NOT ask any follow-up questions. Do NOT attempt to retry or suggest alternatives. ` +
                                    `Simply acknowledge that the action was rejected and the workflow has been stopped. ` +
                                    `End your response with a brief confirmation that no further actions will be taken.`
                            )
                            stateWithHistory.history.push(hardRejectMessage)
                            logger.info("[resumeFromPendingApproval] Added hard reject message to state history", { hardReject: true })
                        } else {
                            const trimmedReason = rejectionReason?.trim()
                            if (trimmedReason) {
                                const rejectionGuidance = buildUserMessage(
                                    `A human reviewer rejected your previous tool call "${interruption.name}".\n\n` +
                                        `Reviewer feedback (treat as user instructions, verbatim):\n` +
                                        `${trimmedReason}\n\n` +
                                        `If the feedback asks you to retry (e.g. "try again", "retry") OR provides guidance on how to proceed differently (e.g. "read X first", "narrow the scope"), proceed now by adapting your next steps/tool calls accordingly. ` +
                                        `Only ask a clarification question if the feedback is not sufficient to act.`
                                )
                                stateWithHistory.history.push(rejectionGuidance)
                                logger.info("[resumeFromPendingApproval] Added rejection guidance to state history", { hasCustomReason: true })
                            } else {
                                const rejectionMessage = buildUserMessage(
                                    `The tool call "${interruption.name}" was rejected. ` + `Ask the user what they want you to do differently, or whether to skip this action entirely.`
                                )
                                stateWithHistory.history.push(rejectionMessage)
                                logger.info("[resumeFromPendingApproval] Added rejection message to state history", { hasCustomReason: false })
                            }
                        }
                    } else {
                        logger.warn("[resumeFromPendingApproval] Could not access state.history directly.")
                    }
                },
                prepareResumeState: async state => {
                    // Bug in the SDK where functions are not serialized properly.
                    // This is a workaround to get the context to work.
                    const unifiedContext: SessionWithTracking<T> = {
                        ...toolContext,
                        ...(state as any)._context
                    }
                    ;(state as any)._context.context = unifiedContext
                }
            })
        } finally {
            this.activeStreamingParams = undefined
        }
        return this.mapLoopResult(loopResult)
    }

    setInputEvent(event: InputEvent): void {
        this.inputEvent = event
    }

    async flushPendingActions(stepId: string, toolName: string, actions?: RunHistoryAction[]): Promise<ChangedItem[]> {
        const changedItems: ChangedItem[] = []
        const toolMetadata = this.toolMetadataMap.get(toolName)
        const isReadOnly = toolMetadata?.isReadOnly ?? true

        // Process actions from tool output
        const actionsToFlush = actions || []

        for (const action of actionsToFlush) {
            // Use the action's step_id if it exists, otherwise use the tool's step_id
            const finalStepId = action.step_id || stepId

            const actionId = await persistRunAction(this.runContext.runId, this.agentConfig, this.session, {
                ...action,
                step_id: finalStepId,
                isReadOnly
            })

            if (actionId) {
                changedItems.push({
                    type_name: EntityType.RUN_HISTORY_ACTION,
                    id: actionId,
                    change_event_type: ChangeEventType.ACTION_EXECUTED
                })
            }
            await this.notificationManager.notify(action)

            // Persist output attributions if:
            // 1. Input event is Identifiable
            // 2. Action has output_items populated
            // 3. Action is not read-only (track both write and read actions per user request)
            const sourceItemRef = this.inputEvent?.getIdentifiableInfo()
            if (sourceItemRef && action.output_items && action.output_items.length > 0 && !isReadOnly) {
                if (action.type === RunHistoryActionType.delete) {
                    await removeOutputAttributions(this.agentConfig.id, action)
                } else {
                    // if we create or update, we persist
                    await persistOutputAttributions(this.agentConfig.id, sourceItemRef, action)
                }
            }
        }

        return changedItems
    }

    private buildToolMetadataMap(): void {
        this.outputs.forEach(output => {
            output.toolbox.forEach(entry => {
                this.toolMetadataMap.set(entry.tool.name, {
                    integration: entry.integration,
                    isReadOnly: entry.isReadOnly
                })
            })
        })
    }

    private chooseModel(): string {
        return "gpt-5.2"
    }

    private getModelSettings() {
        return builderProviderDataModelSettings({
            agentId: this.agentConfig.id,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.runContext.runId,
            user: this.session.user,
            env: settings.nodeEnv
        })
    }

    private getToolContext(): SessionWithTracking<T> {
        const toolApprovals = this.agentConfig.tool_approvals.map((ta: any) => ta.tool_name)

        return {
            ...this.session,
            agent: {
                requireApproval: this.agentConfig.require_approval ?? false,
                toolApprovals: toolApprovals
            },
            runId: this.runContext.runId,
            agentId: this.agentConfig.id
        }
    }

    private buildUserContent(text: string, files?: StoredFile[]): UserMessageContent[] {
        const { trimmedText, attachedFiles } = this.normalizeUserInputs(text, files)

        const content: UserMessageContent[] = []

        this.pushInputTextIfPresent(content, trimmedText)

        const attachmentNote = this.buildAttachmentNote(attachedFiles)
        this.pushInputTextIfPresent(content, attachmentNote)

        content.push(...this.buildAttachmentItems(attachedFiles))

        return content
    }

    private normalizeUserInputs(text: string, files?: StoredFile[]) {
        const trimmedText = text?.trim() ?? ""
        const attachedFiles = (files ?? []).filter((f): f is StoredFile => Boolean(f?.url))
        return { trimmedText, attachedFiles }
    }

    private pushInputTextIfPresent(content: UserMessageContent[], text?: string) {
        const t = text?.trim()
        if (!t) return
        content.push({ type: "input_text", text: t })
    }

    private buildAttachmentNote(attachedFiles: StoredFile[]): string {
        if (attachedFiles.length === 0) return ""

        const lines = attachedFiles.map(file => {
            const name = file.filename || "unnamed file"
            const type = file.mimeType ? ` (${file.mimeType})` : ""
            return `- ${name}${type}`
        })

        return [
            "<ATTACHMENTS>",
            "The following files are attached to the event/message below. The input_file and input_image items that follow in this message correspond to these attachments.",
            ...lines,
            "</ATTACHMENTS>"
        ].join("\n")
    }

    private buildAttachmentItems(attachedFiles: StoredFile[]): UserMessageContent[] {
        const items: UserMessageContent[] = []

        for (const file of attachedFiles) {
            const item = this.fileToContentItem(file)
            if (item) items.push(item)
        }

        return items
    }

    private fileToContentItem(file: StoredFile): UserMessageContent | null {
        if (!file?.url) return null

        switch (file.category) {
            case FileCategory.IMAGE:
                return { type: "input_image", image: file.url } as AgentInputImage

            case FileCategory.DOCUMENT:
                return { type: "input_file", file: { url: file.url } } as AgentInputFile

            default:
                return null
        }
    }

    private buildTextContent(inputEvent: InputEvent): string {
        return buildRunTriggerContextMessage({
            userContext: UserFormatter.formatForAgent(this.session.user),
            userInstructions: this.agentConfig.prompt?.content,
            agentTriggers: formatAgentTriggersForAgent(this.agentConfig.inputs),
            eventContent: inputEvent.formatForAgentRunner()
        })
    }

    protected async onModelEvent(event: ModelEvent, timestamp: number): Promise<void> {
        const streamingParams = this.activeStreamingParams
        if (!streamingParams) return
        const io = getSocketIO()
        const emitter = new StreamEventEmitter(io, {
            runId: streamingParams.runId!,
            agentId: streamingParams.agentId!,
            user: streamingParams.user
        })
        emitter.emit(event, timestamp)
    }

    protected async onToolCallComplete(callId: string, toolName: string, actions?: RunHistoryAction[]): Promise<ChangedItem[]> {
        return this.flushPendingActions(callId, toolName, actions)
    }

    protected async savePendingApprovalState(runId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void> {
        await storePendingApprovalState(runId, serializedState, interruptions)
    }

    protected async loadPendingApprovalState(runId: string) {
        return getPendingApprovalState(runId)
    }

    protected async clearPendingApprovalState(runId: string): Promise<void> {
        await clearPendingApprovalState(runId)
    }

    protected async markRunInProgress(runId: string): Promise<void> {
        await markRunInProgress(runId)
    }

    protected async onApprovalRequest({
        runId,
        stepId,
        name,
        arguments: toolArgs
    }: {
        runId: string
        stepId: string
        name: string
        arguments: string
        interruption: RunToolApprovalItem
    }): Promise<void> {
        if (this.session.user.organizationId) {
            emitCacheInvalidationWithWildcard(this.session.user.organizationId, "runHistory", this.agentConfig.id)
            emitCacheInvalidationWithWildcard(this.session.user.organizationId, "chatHistory", runId)
        }

        try {
            logger.info("[ApprovalFlow] Persisting approval request system event", { runId, stepId })
            await appendToolApprovalRequestSystemEvent(runId, {
                step_id: stepId,
                name,
                arguments: toolArgs
            })
        } catch (error) {
            logger.warn("Failed to append tool approval system event to raw history", { runId, stepId, error })
        }

        try {
            const toolMetadata = this.toolMetadataMap.get(name)
            const integration = toolMetadata?.integration || IntegrationType.TERSE
            const approvalAction: RunHistoryAction = {
                action: `Approval requested for ${name}`,
                integration,
                target: name,
                details: `The bot is requesting approval to execute: ${name} with arguments: ${JSON.stringify(toolArgs)}`,
                step_id: stepId,
                type: RunHistoryActionType.update,
                isReadOnly: false
            }
            await this.notificationManager.notifyApprovalRequest(runId, approvalAction)
        } catch (error) {
            logger.error("Failed to send approval request notification:", { error })
        }
    }

    protected getAgentInitializationParams() {
        const deps: SystemPromptBuilderDependencies<T, TConfig> = {
            session: this.session,
            agent: this.agentConfig,
            outputs: this.outputs
        }

        return {
            name: "Automation Agent",
            systemPromptDeps: deps as SystemPromptBuilderDependencies<SessionWithTracking<T>, ConfigInstance>,
            runContext: this.runContext,
            model: this.chooseModel(),
            tools: this.tools,
            modelSettings: this.getModelSettings()
        }
    }

    private mapLoopResult(
        loopResult: AgentRunnerLoopResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>
    ): ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>> {
        if (loopResult.status === "awaiting_approval") {
            return {
                status: AgentRunResultStatus.AWAITING_APPROVAL,
                state: loopResult.state,
                interruptions: loopResult.interruptions
            }
        }
        return {
            status: AgentRunResultStatus.COMPLETED,
            result: loopResult.result,
            endedWithToolFailure: loopResult.endedWithToolFailure
        }
    }
}

export type { SessionWithTracking } from "./BaseAgentRunner"

export enum AgentRunResultStatus {
    COMPLETED = "completed",
    AWAITING_APPROVAL = "awaiting_approval"
}

export type ApprovalResult<T extends Session, AgentType extends Agent<T, AgentOutputType>> =
    | { status: AgentRunResultStatus.COMPLETED; result: RunResult<T, AgentType>; endedWithToolFailure: boolean }
    | { status: AgentRunResultStatus.AWAITING_APPROVAL; state: RunState<T, AgentType>; interruptions: RunToolApprovalItem[] }

export type Decision = "approve" | "reject"

type ToolMetadata = {
    integration: IntegrationType
    isReadOnly: boolean
}
