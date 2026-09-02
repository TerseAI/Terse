import { RunHistoryStatus } from "terse-types"
import { executionRegionSchema } from "terse-types/ExecutionRegions"

import logger from "../../common/logger"
import { getInputConfigInclude, getOutputConfigInclude } from "../../common/prismaIncludes"
import { db } from "../../loaders/prisma"
import { finalizeRunFailure } from "../../loaders/socket"
import { claimSuspendedRun, finalizeRunStatus, markRunFailed, markRunSkipped } from "../../modules/agents/AgentRunner/runHistory"
import { classifyAgentError } from "../../modules/agents/agentErrorUtils"
import { billingServiceProxyForOrganization, startBillingRun } from "../../services/BillingService"
import { invalidateRunAndChatHistory } from "../../services/CacheInvalidationService"
import { jobExecutorRegistry } from "../../services/jobExecutors/JobExecutorRegistry"
import { AgentWithRelations } from "../../types/prisma"
import { resolveUserInOrg } from "../../utility/identity"
import { RunExecutionJobData } from "../queues/runExecutionQueue"

function loadAgentForExecution(agentId: string, orgId: string): Promise<AgentWithRelations | null> {
    return db().automations.findUnique({
        where: { id: agentId, organization_id: orgId },
        include: {
            prompt: true,
            inputs: { include: getInputConfigInclude() },
            outputs: { include: getOutputConfigInclude() },
            tool_approvals: true,
            project: true
        }
    })
}

export async function handleRunExecution(data: RunExecutionJobData): Promise<void> {
    const { runId, agentId, orgId, userId, jobName, kind, hookResume, enqueuedAtMs, scheduledForMs } = data
    let restoreImageId = data.restoreImageId

    // A delayed resume may fire after the run was cancelled while suspended; only the caller
    // that flips suspended -> in_progress may execute, so a failed claim means drop the job.
    if (restoreImageId) {
        const claim = await claimSuspendedRun(runId)
        if (!claim.claimed) {
            logger.info("Run resumption skipped: run is no longer suspended", { runId, agentId })
            return
        }
        // The suspension row is the source of truth for the snapshot; the payload imageId
        // only covers suspensions parked before run_suspensions was introduced.
        restoreImageId = claim.suspendImageId ?? restoreImageId
    }

    const user = await resolveUserInOrg(userId, orgId)
    if (!user) {
        logger.error("Run execution: user not found; failing run", { runId, userId, orgId })
        await markRunFailed(runId, "User not found for run execution", "agent")
        throw new Error("User not found for run execution")
    }

    const agent = await loadAgentForExecution(agentId, orgId)
    if (!agent) {
        logger.error("Run execution: agent not found; failing run", { runId, agentId, orgId })
        await markRunFailed(runId, "Agent not found for run execution", "agent")
        invalidateRunAndChatHistory(orgId, agentId, runId)
        throw new Error("Agent not found for run execution")
    }

    const runRecord = await db().run_history_records.findUnique({
        where: { id: runId },
        select: { execution_region: true }
    })
    const executionRegion = executionRegionSchema.nullable().parse(runRecord?.execution_region ?? null)

    try {
        // Single billing choke point: every run is gated + base-charged here, before its executor runs.
        // A denied gate fails the run before any sandbox is created or any webhook is delivered.
        // Resumes skip it: the run was already gated + base-charged at original dispatch.
        if (!restoreImageId) {
            const billing = billingServiceProxyForOrganization(orgId, userId)
            await startBillingRun(billing, { organizationId: orgId, runId })
        }

        const executor = jobExecutorRegistry.resolve(kind)
        const outcome = await executor.execute({ runId, agent, orgId, userId, user, jobName, restoreImageId, hookResume, enqueuedAtMs, scheduledForMs, executionRegion })
        switch (outcome.status) {
            case "success":
                await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
                invalidateRunAndChatHistory(orgId, agent.id, runId)
                return
            case "skipped":
                await markRunSkipped(runId, outcome.reason)
                invalidateRunAndChatHistory(orgId, agent.id, runId)
                return
            case "suspended":
                // The executor already parked the run (or /sdk/suspend did); nothing to finalize.
                invalidateRunAndChatHistory(orgId, agent.id, runId)
                return
            case "failed":
                await finalizeRunFailure(runId, classifyAgentError(outcome.cause), user, agent)
                return
            default:
                throw outcome satisfies never
        }
    } catch (error) {
        logger.error("Run execution failed", { error, runId, agentId, kind })
        await finalizeRunFailure(runId, classifyAgentError(error), user, agent)
        throw error
    }
}
