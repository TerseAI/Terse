import { UserSession } from "terse-types/types"

import logger from "../../../common/logger"
import { getInputConfigInclude, getOutputConfigInclude } from "../../../common/prismaIncludes"
import { getActiveDeployForProject } from "../../../common/projectHelper"
import { TriggerRuntime } from "../../../integrations/abstract/TriggerRuntime"
import { db } from "../../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard, finalizeRunFailure } from "../../../loaders/socket"
import { NotificationManager } from "../../../modules/notifications/Notification"
import { billingServiceProxyForOrganization, startBillingRun } from "../../../services/BillingService"
import { SdkJobExecutionService } from "../../../services/SdkJobExecutionService"
import { WebhookJobExecutionService } from "../../../services/WebhookJobExecutionService"
import { captureRunSnapshot, restoreRunSnapshotInto } from "../../../services/memory/memorySnapshots"
import { replayMemorySubtreeKey, replayStateSubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { settings } from "../../../settings"
import { AgentWithRelations, Agent as PrismaAgent } from "../../../types/prisma"
import { emitListenForwardedEvent } from "../ListenBus"
import { classifyAgentError } from "../agentErrorUtils"

import { createRunRecord, markRunFailed } from "./runHistory"

// The job of this class is to take an Input Event, and check if it's a match for an Agent.
// It will then create a Session, and summon the Agent Runner with the create user data.

class ProcessorResult {
    success: boolean
    message: string
    agentConfig: PrismaAgent | null
    runId: string | null

    constructor(success: boolean, message: string, agentConfig: PrismaAgent | null, runId: string | null = null) {
        this.success = success
        this.message = message
        this.agentConfig = agentConfig
        this.runId = runId
    }
}

export class EventProcessor {
    private inputEvent: TriggerRuntime
    private user: UserSession
    private isManuallyTriggered: boolean
    private isTest: boolean
    private localDataPlane: boolean
    private replayOfRunId?: string

    constructor(inputEvent: TriggerRuntime, user: UserSession, options?: { isManuallyTriggered?: boolean; isTest?: boolean; localDataPlane?: boolean; replayOfRunId?: string }) {
        this.inputEvent = inputEvent
        this.user = user
        this.isManuallyTriggered = options?.isManuallyTriggered ?? false
        this.isTest = options?.isTest ?? false
        this.localDataPlane = options?.localDataPlane ?? false
        this.replayOfRunId = options?.replayOfRunId
    }

    async process(): Promise<ProcessorResult[]> {
        logger.info(`Processing input event: ${this.inputEvent.debugLog()}`)

        const results: ProcessorResult[] = []

        // Get integration type from event itself (no hardcoded checks)
        const integrationType = this.inputEvent.integrationType

        // Find all active jobs for this user (already includes all config relations)
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
                tool_approvals: true,
                project: true
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
     * Used for triggering manual agent runs.
     */
    async processSingleAgent(agentId: string): Promise<ProcessorResult[]> {
        logger.info(`Processing single agent ${agentId} for event: ${this.inputEvent.debugLog()}`)

        const agent = await this.loadAgent(agentId)

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

    /**
     * Trigger a run and return immediately with the run ID.
     * The run continues processing asynchronously in the background.
     */
    async triggerSingleAgent(agentId: string): Promise<{ runId: string; agentId: string; agentName: string }> {
        logger.info(`Triggering single agent ${agentId} for event: ${this.inputEvent.debugLog()}`)

        const agent = await this.loadAgent(agentId)
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`)
        }

        const runId = await this.createRunForAgent(agent)
        void this.processAgent(agent, runId).catch(async error => {
            logger.error(`Background processing failed for agent ${agent.id}`, {
                error,
                runId,
                agentId: agent.id
            })
            await this.failRunEarly(runId, agent, `Background processing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
        })

        return {
            runId,
            agentId: agent.id,
            agentName: agent.name
        }
    }

    private async loadAgent(agentId: string): Promise<AgentWithRelations | null> {
        return db().automations.findUnique({
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
                tool_approvals: true,
                project: true
            }
        })
    }

    private async createRunForAgent(agent: AgentWithRelations): Promise<string> {
        const trigger = this.inputEvent.createTriggerMetadata()
        const runId = await createRunRecord({
            agentId: agent.id,
            trigger,
            serializedTriggerEvent: this.inputEvent.getSerializedEvent(),
            isManuallyTriggered: this.isManuallyTriggered,
            isTest: this.isTest,
            triggeredByUserId: this.isManuallyTriggered || this.isTest ? this.user.id : undefined,
            replayOfRunId: this.replayOfRunId
        })
        if (settings.modal && this.replayOfRunId) {
            await restoreRunSnapshotInto({
                originalRunId: this.replayOfRunId,
                projectId: agent.project.id,
                targetMemorySubtreeKey: replayMemorySubtreeKey(runId),
                targetStateSubtreeKey: replayStateSubtreeKey(runId)
            })
        } else if (settings.modal) {
            await captureRunSnapshot({ runId, projectId: agent.project.id, automationId: agent.id, isTest: this.isTest })
        }
        emitCacheInvalidationWithWildcard(this.user.organizationId, "runHistory", agent.id)
        emitCacheInvalidationWithKey(this.user.organizationId, "recentAgents")
        return runId
    }

    private async failRunEarly(runId: string, agent: PrismaAgent, message: string): Promise<void> {
        try {
            await markRunFailed(runId, message, "agent")
            emitCacheInvalidationWithWildcard(this.user.organizationId, "runHistory", agent.id)
        } catch (error) {
            logger.error("Failed to mark run as failed during early validation", {
                error,
                runId,
                agentId: agent.id
            })
        }
        // Notify so users see the failure rather than the run silently
        // sitting in FAILED state. notifyRunFailure swallows its own errors.
        await this.notifyRunFailure(agent, runId, message)
    }

    private async notifyRunFailure(agent: PrismaAgent, runId: string, errorMessage: string): Promise<void> {
        try {
            await new NotificationManager(this.user, agent).notifyRunFailure(runId, errorMessage)
        } catch (error) {
            logger.error("Failed to send run failure notification", {
                error,
                runId,
                agentId: agent.id
            })
        }
    }

    private async processAgent(agent: AgentWithRelations, existingRunId?: string): Promise<ProcessorResult> {
        logger.info(`Processing agent: ${agent.name} (${agent.id})`)

        if (this.localDataPlane) {
            return new ProcessorResult(true, "Local run registered (CLI is the data plane)", agent, existingRunId ?? null)
        }

        // Send event to terse listen listeners
        try {
            emitListenForwardedEvent(this.user.organizationId, {
                type: "forwarded_event",
                agentId: agent.id,
                agentName: agent.name,
                projectId: agent.project?.id ?? null,
                event: this.inputEvent.getSerializedEvent()
            })
        } catch (error) {
            logger.warn("Failed to emit listen-forwarded event", {
                error,
                agentId: agent.id,
                agentName: agent.name
            })
        }

        if (!agent.prompt) {
            if (existingRunId) {
                // failRunEarly notifies internally now.
                await this.failRunEarly(existingRunId, agent, "No prompt found for this agent")
            }
            return new ProcessorResult(false, "No prompt found for this agent", agent, existingRunId ?? null)
        }

        const activeDeploy = await getActiveDeployForProject(agent.project.id)

        // SDK agents with a remote_server_url trigger the user's own infrastructure via webhook
        if (agent.project.remote_server_url) {
            return this.processWebhookAgent(agent, existingRunId)
        }

        // SDK agents run in a Modal sandbox instead of the normal agent pipeline
        if (activeDeploy?.sdk_source_image_id) {
            return this.processSdkAgent(agent, existingRunId)
        } else {
            logger.error("Unknown agent source", { agentId: agent.id, agentName: agent.name })
            throw new Error("Unknown agent source")
        }
    }

    private async processSdkAgent(agent: AgentWithRelations, existingRunId?: string): Promise<ProcessorResult> {
        const runId = existingRunId ?? (await this.createRunForAgent(agent))

        try {
            logger.info(`Starting SDK sandbox execution for agent "${agent.name}"`, { runId, agentId: agent.id })

            const billingForRunner = billingServiceProxyForOrganization(this.user.organizationId, this.user.id)
            await startBillingRun(billingForRunner, { organizationId: this.user.organizationId, runId })
        } catch (error) {
            logger.error(`SDK sandbox failed to start for agent "${agent.name}"`, { error, runId, agentId: agent.id })
            await finalizeRunFailure(runId, classifyAgentError(error), this.user, agent)
            return new ProcessorResult(false, error instanceof Error ? error.message : "SDK job failed to start", agent, runId)
        }

        // Fire-and-forget: sandbox runs asynchronously
        const service = new SdkJobExecutionService()
        void service
            .execute({
                runId,
                agent,
                orgId: this.user.organizationId,
                userId: agent.user_id,
                user: this.user,
                jobName: agent.name
            })
            .catch(async error => {
                logger.error(`SDK sandbox execution failed for agent "${agent.name}"`, {
                    error,
                    runId,
                    agentId: agent.id
                })
                await finalizeRunFailure(runId, classifyAgentError(error), this.user, agent)
            })

        return new ProcessorResult(true, "SDK job execution started", agent, runId)
    }

    private async processWebhookAgent(agent: AgentWithRelations, existingRunId?: string): Promise<ProcessorResult> {
        const runId = existingRunId ?? (await this.createRunForAgent(agent))

        const event = this.inputEvent.getSerializedEvent()

        const remoteServerUrl = agent.project.remote_server_url
        const signingSecret = agent.project.signing_secret
        if (!remoteServerUrl || !signingSecret) {
            const reason = !remoteServerUrl ? `Webhook agent "${agent.name}" is missing remote_server_url` : `Webhook agent "${agent.name}" is missing signing_secret`
            await finalizeRunFailure(runId, classifyAgentError(new Error(reason)), this.user, agent)
            return new ProcessorResult(false, reason, agent, runId)
        }

        logger.info(`Starting webhook job execution for agent "${agent.name}"`, { runId, agentId: agent.id, remoteServerUrl })

        // Fire-and-forget: webhook execution runs asynchronously
        const service = new WebhookJobExecutionService()
        void service
            .execute({
                remoteServerUrl,
                runId,
                agent,
                orgId: this.user.organizationId,
                user: this.user,
                event,
                jobName: agent.name,
                signingSecret
            })
            .catch(async error => {
                logger.error(`Webhook job execution failed for agent "${agent.name}"`, {
                    error,
                    runId,
                    agentId: agent.id
                })
                await finalizeRunFailure(runId, classifyAgentError(error), this.user, agent)
            })

        return new ProcessorResult(true, "Webhook job execution started", agent, runId)
    }
}
