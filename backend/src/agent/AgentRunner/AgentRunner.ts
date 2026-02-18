import { Agent, AgentInputItem, AgentOutputType, RunResult, RunState, RunToolApprovalItem, StreamedRunResult, Tool, protocol, user } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"

import { settings } from "../../config/settings"
import { InputEvent } from "../../integrations/abstract/InputEvent"
import { KnowledgeBase } from "../../knowledgeBase/abstract/KnowledgeBase"
import logger from "../../logger"
import { NotificationManager } from "../../notifications/Notification"
import { Output } from "../../outputs/abstract/Output"
import { getSocketIO } from "../../services/CacheInvalidationService"
import { FileCategory, StoredFile } from "../../services/FileStorageService"
import { ConfigInstance } from "../../shared/Configs"
import { EntityType } from "../../shared/Entities"
import { IntegrationType } from "../../shared/Integrations"
import { ChangeEventType, ChangedItem, ModelEvent } from "../../shared/ModelEvents"
import type { RunHistoryAction, RunHistoryModelEvent, RunHistoryModelSocketEvent, TrackingParams } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { AgentWithRelations } from "../../types/prisma"
import { Session } from "../../types/session"
import { UserFormatter } from "../../utility/UserFormatter"
import { randomString } from "../../utility/strings"
import { RunHistoryChatMemorySession, recentHistoryCallback } from "../CustomMemorySession"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"
import { transformAgentStreamToModelEvents } from "../streaming"
import { appendToolApprovalRequestSystemEvent } from "../systemEvents/toolApprovalSystemEvent"
import { isFailedToolExecutionStatus } from "../toolExecution"

import { persistRunAction } from "./EventProcessor"
import { processModelEventStream } from "./StreamProcessor"
import { RunContext, SystemPromptBuilder, SystemPromptBuilderDependencies } from "./SystemPromptBuilder"
import { formatAgentTriggersForAgent } from "./formatContext"
import { persistOutputAttributions, removeOutputAttributions } from "./persistOutputAttributions"
import { clearPendingApprovalState, getPendingApprovalState, markRunInProgress, storePendingApprovalState } from "./runHistory"

// Types from @openai/agents SDK for content items
type AgentInputText = protocol.InputText
type AgentInputImage = protocol.InputImage
type AgentInputFile = protocol.InputFile

type UserMessageContent = AgentInputText | AgentInputImage | AgentInputFile

export class AgentRunner<T extends Session, TConfig extends ConfigInstance, KBConfig extends ConfigInstance> {
    private session: T
    private inputEvent: InputEvent | null = null
    private agentConfig: AgentWithRelations
    private outputs: Output<TConfig>[]
    private knowledgeBases: KnowledgeBase<KBConfig>[]
    private agent?: Agent<SessionWithTracking<T>, AgentOutputType>
    private tools: Tool<SessionWithTracking<T>>[] = []
    private runContext: RunContext
    private toolMetadataMap: Map<string, ToolMetadata> = new Map()
    private endedWithToolFailure = false
    private memorySession: RunHistoryChatMemorySession
    private maxTurns: number
    private notificationManager: NotificationManager

    constructor(session: T, outputs: Output<TConfig>[], knowledgeBases: KnowledgeBase<KBConfig>[], agent: AgentWithRelations, runContext: RunContext, maxTurns: number = 50) {
        this.session = session
        this.outputs = outputs
        this.knowledgeBases = knowledgeBases
        this.agentConfig = agent
        const toolsMap = new Map<string, Tool<SessionWithTracking<T>>>()

        outputs.forEach(output => {
            output.toolbox.forEach(entry => {
                toolsMap.set(entry.tool.name, entry.tool)
            })
        })

        knowledgeBases.forEach(kb => {
            kb.toolbox.forEach(entry => {
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

    async run(streamingParams?: TrackingParams): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        if (!this.inputEvent) {
            throw new Error("No input event set. Call setInputEvent() before run()")
        }

        this.resetRunOutcomeTracking()
        await this.initializeAgent()

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before run()")
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

        const result = await runner.run(this.agent, userHistory, {
            context: this.getToolContext(),
            stream: true,
            session: this.memorySession,
            sessionInputCallback: recentHistoryCallback,
            maxTurns: this.maxTurns
        })

        await this.processStream(result, streamingParams)

        return await this.buildResult(result, streamingParams)
    }

    async userMessageRun(userMessage: string, files?: StoredFile[], streamingParams?: TrackingParams): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        this.resetRunOutcomeTracking()
        await this.initializeAgent()

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before run()")
        }

        const content = this.buildUserContent(userMessage, files)
        const userHistory = this.buildUserHistory(content)
        const runner = runnerFactory({
            agentId: this.agentConfig.id,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.runContext.runId,
            user: this.session.user,
            env: settings.nodeEnv
        })
        const result = await runner.run(this.agent, userHistory, {
            context: this.getToolContext(),
            stream: true,
            session: this.memorySession,
            sessionInputCallback: recentHistoryCallback,
            maxTurns: this.maxTurns
        })

        await this.processStream(result, streamingParams)

        return await this.buildResult(result, streamingParams)
    }

    private buildUserHistory(content: UserMessageContent[]): AgentInputItem[] {
        return [user(content)]
    }

    async resumeFromPendingApproval(
        decision: Decision,
        stepId: string,
        streamingParams?: TrackingParams,
        rejectionReason?: string,
        hardReject?: boolean
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        this.resetRunOutcomeTracking()
        await this.initializeAgent()

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before resumeFromPendingApproval()")
        }

        // Retrieve pending approval state from database
        const pendingState = await getPendingApprovalState(this.runContext.runId)
        if (!pendingState) {
            throw new Error(`No pending approval state found for run ${this.runContext.runId}`)
        }

        // Deserialize state
        if (!pendingState.serializedState || typeof pendingState.serializedState !== "string") {
            throw new Error(`Invalid serialized state format for run ${this.runContext.runId}. Expected string, got ${typeof pendingState.serializedState}`)
        }

        // Deserialize the state first
        const state = await RunState.fromString<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>(this.agent, pendingState.serializedState)

        const storedInterruption = pendingState.interruptions.find(interruptionItem => (interruptionItem.rawItem as any)?.callId === stepId)

        if (!storedInterruption) {
            // Log for debugging
            logger.error(`[resumeFromPendingApproval] Could not find interruption for step_id: ${stepId}`)
            logger.error(`[resumeFromPendingApproval] Available stored interruptions:`, {
                interruptions: pendingState.interruptions.map(interruptionItem => ({
                    callId: (interruptionItem.rawItem as any)?.callId || null,
                    name: interruptionItem.name
                }))
            })
            throw new Error(`Could not find matching interruption for step_id ${stepId}`)
        }

        // Use the stored interruption object directly (matching SDK pattern)
        // The interruption object should be compatible with state.approve/reject
        const interruption = storedInterruption as RunToolApprovalItem

        // Apply decision using the stored interruption
        if (decision === "approve") {
            state.approve(interruption)
        } else {
            state.reject(interruption)
            const stateWithHistory = state as unknown as { history?: AgentInputItem[] }
            if (stateWithHistory.history && Array.isArray(stateWithHistory.history)) {
                if (hardReject) {
                    // Hard reject: tell the agent to stop completely without asking questions or retrying
                    const hardRejectMessage = user(
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
                        // Treat the rejection reason as actionable user guidance (verbatim) so the agent can
                        // reliably detect "try again" or other imperative instructions (e.g. "Read X first").
                        const rejectionGuidance = user(
                            `A human reviewer rejected your previous tool call "${interruption.name}".\n\n` +
                                `Reviewer feedback (treat as user instructions, verbatim):\n` +
                                `${trimmedReason}\n\n` +
                                `If the feedback asks you to retry (e.g. "try again", "retry") OR provides guidance on how to proceed differently (e.g. "read X first", "narrow the scope"), proceed now by adapting your next steps/tool calls accordingly. ` +
                                `Only ask a clarification question if the feedback is not sufficient to act.`
                        )
                        stateWithHistory.history.push(rejectionGuidance)
                        logger.info("[resumeFromPendingApproval] Added rejection guidance to state history", { hasCustomReason: true })
                    } else {
                        const rejectionMessage = user(
                            `The tool call "${interruption.name}" was rejected. ` + `Ask the user what they want you to do differently, or whether to skip this action entirely.`
                        )
                        stateWithHistory.history.push(rejectionMessage)
                        logger.info("[resumeFromPendingApproval] Added rejection message to state history", { hasCustomReason: false })
                    }
                }
            } else {
                logger.warn("[resumeFromPendingApproval] Could not access state.history directly.")
            }
        }

        // Move run back to in-progress now that we're resuming execution
        await markRunInProgress(this.runContext.runId)

        // Clear pending approval state
        await clearPendingApprovalState(this.runContext.runId)

        // Resume execution
        const runner = runnerFactory({
            agentId: this.agentConfig.id,
            agentType: AgentType.AGENT_RUNNER,
            runId: this.runContext.runId,
            user: this.session.user,
            env: settings.nodeEnv
        })
        const toolContext = this.getToolContext()

        // Bug in the SDK where functions are not serialized properly.
        // This is a workaround to get the context to work.
        const unifiedContext: SessionWithTracking<T> = {
            ...toolContext,
            ...state._context
        }
        state._context.context = unifiedContext

        const result = await runner.run(this.agent, state, {
            context: toolContext,
            stream: true,
            session: this.memorySession,
            sessionInputCallback: recentHistoryCallback,
            maxTurns: this.maxTurns
        })

        await this.processStream(result, streamingParams)

        return await this.buildResult(result, streamingParams)
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

        // Populate metadata from knowledge base toolboxes
        this.knowledgeBases.forEach(kb => {
            kb.toolbox.forEach(entry => {
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

    async initializeAgent(): Promise<void> {
        const deps: SystemPromptBuilderDependencies<T, TConfig, KBConfig> = {
            session: this.session,
            agent: this.agentConfig,
            outputs: this.outputs,
            knowledgeBases: this.knowledgeBases
        }

        const builder = new SystemPromptBuilder<T, TConfig, KBConfig>(deps, this.runContext).withStandardSections()

        const fullSystemPrompt = await builder.build()

        this.agent = new Agent<SessionWithTracking<T>, AgentOutputType>({
            name: "Automation Agent",
            instructions: fullSystemPrompt,
            model: this.chooseModel(),
            tools: this.tools,
            modelSettings: builderProviderDataModelSettings({
                agentId: this.agentConfig.id,
                agentType: AgentType.AGENT_RUNNER,
                runId: this.runContext.runId,
                user: this.session.user,
                env: settings.nodeEnv
            })
        })
    }

    private getToolContext(): SessionWithTracking<T> {
        const toolApprovals = this.agentConfig.tool_approvals.map((ta: any) => ta.tool_name)

        return {
            ...this.session,
            agent: {
                requireApproval: this.agentConfig.require_approval ?? false,
                toolApprovals: toolApprovals
            }
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
        return `
<USER_CONTEXT>
${UserFormatter.formatForAgent(this.session.user)}
</USER_CONTEXT>

<USER_INSTRUCTIONS>
${this.agentConfig.prompt?.content || "No instructions provided"}
</USER_INSTRUCTIONS>

<AGENT_TRIGGERS>
${formatAgentTriggersForAgent(this.agentConfig.inputs)}
</AGENT_TRIGGERS>

<EVENT>
${inputEvent.formatForAgentRunner()}
</EVENT>
        `.trim()
    }

    private resetRunOutcomeTracking(): void {
        this.endedWithToolFailure = false
    }

    private observeModelEvent(event: ModelEvent): void {
        if (event.type !== "ToolCallComplete") return

        const toolFailed = isFailedToolExecutionStatus(event.status) || Boolean(event.errorContext)
        // We only care whether execution ended on a failed tool call.
        // A subsequent successful tool completion clears this.
        this.endedWithToolFailure = toolFailed
    }

    private async *trackEventStream(eventStream: AsyncGenerator<ModelEvent, void, unknown>): AsyncGenerator<ModelEvent, void, unknown> {
        for await (const event of eventStream) {
            this.observeModelEvent(event)
            yield event
        }
    }

    private async processStream<TSession extends Session = Session, TAgent extends Agent<any, any> = Agent<Session, any>>(
        result: StreamedRunResult<TSession, TAgent>,
        streamingParams?: TrackingParams
    ): Promise<void> {
        const shouldStream = !!streamingParams

        if (shouldStream) {
            await this.processWithStreaming(result, streamingParams!)
        } else {
            await this.processWithLogging(result)
        }
    }

    private async processWithStreaming<TSession extends Session = Session, TAgent extends Agent<any, any> = Agent<Session, any>>(
        result: StreamedRunResult<TSession, TAgent>,
        streamingParams: TrackingParams
    ): Promise<void> {
        const io = getSocketIO()

        const eventStream = transformAgentStreamToModelEvents(result, {
            toolToIntegrationMap: this.getToolToIntegrationMap(),
            onToolCallComplete: (callId, toolName, actions) => {
                return this.flushPendingActions(callId, toolName, actions)
            }
        })

        const trackedEventStream = this.trackEventStream(eventStream)

        await processModelEventStream(trackedEventStream, {
            runId: streamingParams.runId!,
            agentId: streamingParams.agentId!,
            user: streamingParams.user,
            io
        })
    }

    private getToolToIntegrationMap(): Map<string, IntegrationType> {
        const map = new Map<string, IntegrationType>()
        this.toolMetadataMap.forEach((metadata, toolName) => {
            map.set(toolName, metadata.integration)
        })
        return map
    }

    private async processWithLogging<TSession extends Session = Session, TAgent extends Agent<any, any> = Agent<Session, any>>(result: StreamedRunResult<TSession, TAgent>): Promise<void> {
        for await (const event of result) {
            this.logRawEvent(event)
        }
    }

    private logRawEvent(event: any): void {
        if (event.type === "raw_model_stream_event") {
            logger.info(event.type, { data: event.data })
        } else if (event.type === "agent_updated_stream_event") {
            logger.info(event.type, { agentName: event.agent.name })
        } else if (event.type === "run_item_stream_event") {
            logger.info(event.type, { item: event.item })
        }
    }

    private async buildResult(result: any, streamingParams?: TrackingParams): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        const hasInterruptions = result.interruptions && result.interruptions.length > 0

        if (hasInterruptions) {
            const serializedState = JSON.stringify(result.state)
            const interruptionsToStore = result.interruptions.map((interruption: RunToolApprovalItem) => {
                // Store the full interruption object, including rawItem which contains callId
                return {
                    type: interruption.type || "tool_approval_item",
                    rawItem: interruption.rawItem,
                    agent: interruption.agent,
                    toolName: interruption.toolName || interruption.name,
                    name: interruption.name,
                    arguments: interruption.arguments
                }
            })

            // Store pending approval state in database
            await storePendingApprovalState(this.runContext.runId, serializedState, interruptionsToStore)

            // Emit ToolApprovalRequest events for each interruption
            if (streamingParams) {
                const io = getSocketIO()
                for (const interruption of result.interruptions) {
                    const stepId = (interruption.rawItem as any)?.callId
                    if (!stepId) {
                        logger.warn("Skipping approval request event because interruption has no callId", {
                            runId: this.runContext.runId,
                            toolName: interruption.name
                        })
                        continue
                    }

                    const approvalRequest: ModelEvent = {
                        type: "ToolApprovalRequest",
                        step_id: stepId,
                        name: interruption.name,
                        arguments: interruption.arguments
                    }

                    try {
                        await appendToolApprovalRequestSystemEvent(this.runContext.runId, {
                            step_id: approvalRequest.step_id,
                            name: approvalRequest.name,
                            arguments: approvalRequest.arguments
                        })
                    } catch (error) {
                        logger.warn("Failed to append tool approval system event to raw history", { runId: this.runContext.runId, stepId: approvalRequest.step_id, error })
                    }

                    if (io && streamingParams.user.organizationId) {
                        const runHistoryModelEvent: RunHistoryModelEvent = {
                            ...approvalRequest,
                            id: `approval-request-live-${randomString(15)}`,
                            timestamp: Date.now()
                        }
                        const payload: RunHistoryModelSocketEvent = {
                            runId: streamingParams.runId!,
                            agentId: streamingParams.agentId!,
                            runHistoryModelEvent
                        }
                        io.to(SocketRooms.organization(streamingParams.user.organizationId)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
                    }

                    // Send notification for approval request
                    try {
                        const toolMetadata = this.toolMetadataMap.get(interruption.name)
                        const integration = toolMetadata?.integration || IntegrationType.TERSE

                        const approvalAction: RunHistoryAction = {
                            action: `Approval requested for ${interruption.name}`,
                            integration,
                            target: interruption.name,
                            details: `The bot is requesting approval to execute: ${interruption.name} with arguments: ${JSON.stringify(interruption.arguments)}`,
                            step_id: stepId,
                            type: RunHistoryActionType.update,
                            isReadOnly: false
                        }

                        await this.notificationManager.notifyApprovalRequest(this.runContext.runId, approvalAction)
                    } catch (error) {
                        logger.error("Failed to send approval request notification:", { error })
                    }
                }
            }

            return {
                status: AgentRunResultStatus.AWAITING_APPROVAL,
                state: result.state,
                interruptions: result.interruptions
            }
        }

        // Clear any pending approval state if run completed successfully
        await clearPendingApprovalState(this.runContext.runId)

        return {
            status: AgentRunResultStatus.COMPLETED,
            result,
            endedWithToolFailure: this.endedWithToolFailure
        }
    }
}

export type SessionWithTracking<T extends Session> = T & {
    agent: {
        requireApproval: boolean
        toolApprovals?: string[]
    }
}

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
