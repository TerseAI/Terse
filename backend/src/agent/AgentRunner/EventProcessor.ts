import { AgentOutputType, Agent as OpenAIAgent, RunResult } from "@openai/agents"

import { InputEvent } from "../../integrations/abstract/InputEvent"
import { KnowledgeBase } from "../../knowledgeBase/abstract/KnowledgeBase"
import { KnowledgeBaseFactory } from "../../knowledgeBase/abstract/KnowledgeBaseFactory"
import logger from "../../logger"
import { Output } from "../../outputs/abstract/Output"
import { OutputFactory } from "../../outputs/abstract/OutputFactory"
import { db } from "../../prismaClient"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard, getRealtimeSocket, markRunFailedAndInvalidate } from "../../realtimeSocket"
import { ConfigInstance } from "../../shared/Configs"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { User } from "../../shared/types"
import { AgentWithRelations, Agent as PrismaAgent } from "../../types/prisma"
import { Session } from "../../types/session"
import { trackActionTaken, trackAgentTriggered } from "../../utility/analytics"
import { getInputConfigInclude, getKnowledgeBaseConfigInclude, getOutputConfigInclude } from "../../utility/prismaIncludes"
import { classifyAgentError } from "../agentErrorUtils"

import { AgentRunner, ApprovalResult, SessionWithTracking } from "./AgentRunner"
import { filterEvent } from "./EventFilter"
import { RunContext } from "./SystemPromptBuilder"
import { reportRunErrorToRun } from "./runErrorReporter"
import { appendRunAction, createRunRecord, finalizeRunStatus, markRunFailed, markRunProcessed, markRunSkipped } from "./runHistory"

// The job of this class is to take an Input Event, and check if it's a match for an Agent.
// It will then create a Session, and summon the Agent Runner with the create user data.

export class ProcessorResult<T extends Session = SessionWithTracking<Session>> {
    success: boolean
    message: string
    agentConfig: PrismaAgent | null
    approvalResult?: ApprovalResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>> | null

    constructor(
        success: boolean,
        message: string,
        agentConfig: PrismaAgent | null,
        approvalResult?: ApprovalResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>> | null
    ) {
        this.success = success
        this.message = message
        this.agentConfig = agentConfig
        this.approvalResult = approvalResult
    }
}

export class EventProcessor {
    private inputEvent: InputEvent
    private user: User

    constructor(inputEvent: InputEvent, user: User) {
        this.inputEvent = inputEvent
        this.user = user
    }

    async process(): Promise<ProcessorResult[]> {
        logger.info(`Processing input event: ${this.inputEvent.debugLog()}`)

        const results: ProcessorResult[] = []

        // Get integration type from event itself (no hardcoded checks)
        const integrationType = this.inputEvent.integrationType

        // Find all active agents for this user (already includes all config relations)
        const agents: AgentWithRelations[] = await db().automations.findMany({
            where: {
                organization_id: this.user.organizationId,
                is_active: true
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
                tool_approvals: true
            }
        })

        if (agents.length === 0) {
            return [new ProcessorResult(false, "No agents found for this user", null)]
        }

        // Filter agents using event's own filtering method
        // Each event type handles its own matching logic (no switch statements)
        const matchingAgents = agents.filter(agent => agent.inputs.some(input => this.inputEvent.matchesAgentTrigger(input)))

        if (matchingAgents.length === 0) {
            return [new ProcessorResult(false, `No agents match this ${integrationType} event`, null)]
        }

        logger.info(`Found ${matchingAgents.length} matching agent(s) for ${integrationType} event`)

        // Process each matching agent
        for (const agent of matchingAgents) {
            try {
                const result = await this.processAgent(agent)
                results.push(result)
            } catch (error) {
                logger.error(`Error processing agent ${agent.id}`, {
                    error,
                    agentId: agent.id,
                    agentName: agent.name
                })
                results.push(new ProcessorResult(false, `Error processing agent: ${error instanceof Error ? error.message : "Unknown error"}`, agent))
            }
        }

        return results
    }

    /**
     * Process the event against a single agent by ID, skipping matching logic.
     * Used for sample event execution (triggerAgentRun) to test a specific agent.
     */
    async processSingleAgent(agentId: string): Promise<ProcessorResult[]> {
        logger.info(`Processing single agent ${agentId} for event: ${this.inputEvent.debugLog()}`)

        const agent = await db().automations.findUnique({
            where: {
                id: agentId,
                organization_id: this.user.organizationId
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
                tool_approvals: true
            }
        })

        if (!agent) {
            return [new ProcessorResult(false, `Agent ${agentId} not found`, null)]
        }

        try {
            const result = await this.processAgent(agent)
            return [result]
        } catch (error) {
            logger.error(`Error processing agent ${agentId}`, { error, agentId })
            return [new ProcessorResult(false, `Error processing agent: ${error instanceof Error ? error.message : "Unknown error"}`, agent)]
        }
    }

    private createKnowledgeBases(agentKnowledgeBases: AgentWithRelations["knowledge_bases"]): KnowledgeBase<ConfigInstance>[] {
        return KnowledgeBaseFactory.createKnowledgeBasesFromAgent(agentKnowledgeBases)
    }

    private async processAgent(agent: AgentWithRelations): Promise<ProcessorResult> {
        logger.info(`Processing agent: ${agent.name} (${agent.id})`)

        if (!agent.prompt) {
            return new ProcessorResult(false, "No prompt found for this agent", agent)
        }

        // Initialize run history record with trigger details
        const trigger = this.inputEvent.createTriggerMetadata()
        const runId = await createRunRecord({
            agentId: agent.id,
            trigger
        })
        emitCacheInvalidationWithWildcard(this.user.organizationId, "runHistory", agent.id)
        emitCacheInvalidationWithKey(this.user.organizationId, "recentAgents")

        // Get the outputs from agent relations (already fetched with config)
        if (!agent.outputs || agent.outputs.length === 0) {
            return new ProcessorResult(false, "No output integrations found for this agent", agent)
        }

        // Create outputs from agent configuration
        let outputs: Output<ConfigInstance>[]
        try {
            outputs = OutputFactory.createOutputsFromAgent(agent)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            return new ProcessorResult(false, `Failed to create outputs: ${errorMessage}`, agent)
        }

        // Create base session for AgentRunner
        const session: Session = {
            user: this.user,
            isUserInitiated: true
        }

        // Filter the event using AI to see if it's relevant to this agent
        let filterResult
        try {
            const filterResponse = await filterEvent(this.inputEvent, agent.prompt, true, {
                runId,
                userId: this.user.id,
                agentId: agent.id,
                organizationId: this.user.organizationId
            })

            filterResult = filterResponse.result
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            logger.error(`Error filtering event for agent "${agent.name}"`, {
                error,
                agentId: agent.id,
                agentName: agent.name,
                runId
            })

            try {
                await markRunFailed(runId, errorMessage, "filter")
                emitCacheInvalidationWithWildcard(this.user.organizationId, "runHistory", agent.id)
            } catch (e) {
                logger.error("Failed to mark run as failed", {
                    error: e,
                    runId,
                    agentId: agent.id
                })
            }

            return new ProcessorResult(false, `Error during filtering: ${errorMessage}`, agent)
        }

        if (!filterResult.isRelevant) {
            logger.info(`Event is not relevant to agent "${agent.name}": ${filterResult.reason}`)
            try {
                await markRunSkipped(runId, filterResult.reason)
                // Emit cache invalidation to update UI
                emitCacheInvalidationWithWildcard(this.user.organizationId, "runHistory", agent.id)
            } catch (e) {
                logger.error("Failed to mark run skipped", {
                    error: e,
                    runId,
                    agentId: agent.id
                })
            }
            return new ProcessorResult(false, `Not relevant: ${filterResult.reason}`, agent)
        }

        try {
            await markRunProcessed(runId, filterResult.reason)
        } catch (e) {
            logger.error("Failed to mark run processed", {
                error: e,
                runId,
                agentId: agent.id
            })
        }

        logger.info(`Event is relevant to agent "${agent.name}"`)

        // Track agent triggered analytics event (organization-scoped)
        trackAgentTriggered(this.user.id, {
            agentId: agent.id,
            agentName: agent.name,
            triggerType: trigger.integration,
            triggerSource: trigger.source,
            runId
        })

        // Create knowledge bases from agent configuration
        const knowledgeBases = this.createKnowledgeBases(agent.knowledge_bases || [])

        // Create agent runner with the session and outputs
        const runContext: RunContext = { runId }
        const agentRunner = new AgentRunner(session, outputs, knowledgeBases, agent, runContext)
        agentRunner.setInputEvent(this.inputEvent)

        // Run the agent runner with streaming parameters
        let result: ApprovalResult<SessionWithTracking<Session>, OpenAIAgent<SessionWithTracking<Session>, AgentOutputType>>
        try {
            result = await agentRunner.run({
                runId,
                userId: this.user.id,
                agentId: agent.id,
                organizationId: this.user.organizationId
            })
        } catch (error) {
            const classified = classifyAgentError(error)
            logger.error(`Error running agent "${agent.name}"`, {
                error,
                agentId: agent.id,
                agentName: agent.name,
                runId
            })
            await markRunFailedAndInvalidate(runId, classified.message, this.user.organizationId, agent.id)
            await reportRunErrorToRun({
                runId,
                agentId: agent.id,
                organizationId: this.user.organizationId,
                classified,
                io: getRealtimeSocket()
            })
            throw error
        }

        if (result.status === "completed") {
            logger.info(`Agent "${agent.name}" completed:`, {
                finalOutput: result.result.finalOutput
            })
            return persistRunResult(runId, result.result, session, agent, result)
        } else {
            logger.info(`Agent "${agent.name}" awaiting approval:`)
            return new ProcessorResult<SessionWithTracking<Session>>(false, "Agent awaiting approval", agent, result)
        }
    }
}

async function persistRunResult<T extends Session>(
    runId: string,
    result: RunResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>>,
    session: T,
    agent: PrismaAgent,
    approvalResult?: ApprovalResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>> | null
): Promise<ProcessorResult<SessionWithTracking<T>>> {
    // Finalize run status
    const hasFinalOutput = Boolean(result.finalOutput)
    try {
        await finalizeRunStatus(runId, hasFinalOutput ? "success" : "failed")
        // Invalidate all run history queries for this agent when status changes
        emitCacheInvalidationWithWildcard(session.user.organizationId, "runHistory", agent.id)
    } catch (e) {
        logger.error("Failed to finalize run status", {
            error: e,
            runId,
            agentId: agent.id
        })
    }

    const finalOutput = typeof result.finalOutput === "string" ? result.finalOutput : ""
    return new ProcessorResult<SessionWithTracking<T>>(hasFinalOutput, finalOutput, agent, approvalResult)
}

export async function persistRunAction<T extends Session>(runId: string, agent: PrismaAgent, session: T, action: RunHistoryAction): Promise<string | undefined> {
    try {
        const actionId = await appendRunAction(runId, action)
        emitCacheInvalidationWithWildcard(session.user.organizationId, "runHistory", agent.id)
        emitCacheInvalidationWithKey(session.user.organizationId, "recentActions")

        trackActionTaken(session.user.id, {
            runId,
            actionType: action.type,
            integration: action.integration,
            target: action.target,
            isReadOnly: action.isReadOnly
        })

        return actionId
    } catch (e) {
        logger.error("Failed to append run action", {
            error: e,
            runId,
            agentId: agent.id
        })
    }
    return undefined
}
